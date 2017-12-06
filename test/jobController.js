"use strict";

const BalanceHolder = artifacts.require('./BalanceHolder.sol');
const ERC20Library = artifacts.require('./ERC20Library.sol');
const FakeCoin = artifacts.require('./FakeCoin.sol');
const JobController = artifacts.require('./JobController.sol');
const Mock = artifacts.require('./Mock.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const Roles2LibraryInterface = artifacts.require('./Roles2LibraryInterface.sol');
const Storage = artifacts.require('./Storage.sol');
const UserLibrary = artifacts.require('./UserLibrary.sol');

const Asserts = require('./helpers/asserts');
const Promise = require('bluebird');
const Reverter = require('./helpers/reverter');
const eventsHelper = require('./helpers/eventsHelper');

const helpers = require('./helpers/helpers');


contract('JobController', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);
  const roles2LibraryInterface = web3.eth.contract(Roles2LibraryInterface.abi).at('0x0');
  const userLibraryInterface = web3.eth.contract(UserLibrary.abi).at('0x0');
  let fakeCoin;
  let storage;
  let jobController;
  let multiEventsHistory;
  let paymentProcessor;
  let erc20Library;
  let userLibrary;
  let paymentGateway;
  let balanceHolder;
  let mock;

  const client = accounts[1];
  const worker = accounts[2];
  const stranger = accounts[9];

  const assertInternalBalance = (address, coinAddress, expectedValue) => {
    return (actualValue) => {
      return paymentGateway.getBalance(address, coinAddress)
      .then(asserts.equal(expectedValue));
    };
  };

  const assertExternalBalance = (address, coinAddress, expectedValue) => {
    return (actualValue) => {
      return paymentGateway.getBalanceOf(address, coinAddress)
      .then(asserts.equal(expectedValue));
    };
  };

  const assertExpectations = (expected = 0, callsCount = null) => {
    let expectationsCount;
    return () => {
      return mock.expectationsLeft()
      .then(asserts.equal(expected))
      .then(() => mock.expectationsCount())
      .then(result => expectationsCount = result)
      .then(() => mock.callsCount())
      .then(result => asserts.equal(callsCount === null ? expectationsCount : callsCount)(result));
    };
  };

  const ignoreAuth = (enabled = true) => {
      if (enabled) {
          return JobController.deployed().then(jobController => jobController.setRoles2Library(Roles2Library.address));
      } else {
          return JobController.deployed().then(jobController => jobController.setRoles2Library(mock.address));
      }
  };

  const ignoreSkillsCheck = (enabled = true) => {
    return mock.ignore(userLibraryInterface.hasSkills.getData(0,0,0,0).slice(0, 10), enabled);
  }

  const operationAllowance = (operation, args, results) => {
    let stages = {
      CREATED: false,
      ACCEPTED: false,
      PENDING_START: false,
      STARTED: false,
      PENDING_FINISH: false,
      FINISHED: false,
      FINALIZED: false
    };

    for (let stage in results) {
      stages[stage] = results[stage];
    }

    const jobId = 1;
    const jobArea = 4;
    const jobCategory = 4;
    const jobSkills = 4;
    const jobDetails = 'Job details';
    const additionalTime = 60;

    const workerRate = '0x12f2a36ecd555';
    const workerOnTop = '0x12f2a36ecd555';
    const jobEstimate = 180;

    return Promise.resolve()
      // Represents full chain of interactions between client and worker
      // Provided `operation` will try to execute on each stage, comparing with expected results

      .then(() => jobController.postJob(jobArea, jobCategory, jobSkills, jobDetails, {from: client}))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.CREATED))

      .then(() => jobController.postJobOffer(jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}))
      .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.ACCEPTED))

      .then(() => jobController.startWork(jobId, {from: worker}))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.PENDING_START))

      .then(() => jobController.confirmStartWork(jobId, {from: client}))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.STARTED))

      .then(() => jobController.endWork(jobId, {from: worker}))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.PENDING_FINISH))

      .then(() => jobController.confirmEndWork(jobId, {from: client}))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.FINISHED))

      .then(() => jobController.releasePayment(jobId))
      .then(() => operation.call(...args))
      .then(result => assert.equal(result, stages.FINALIZED));
  }

  const onReleasePayment = (timeSpent, jobPaymentEstimate, pauses) => {
    const jobId = 1;
    const workerRate = 200000000000;
    const workerOnTop = 1000000000;
    const jobEstimate = 240;

    let clientBalanceBefore;
    let workerBalanceBefore;

    const timeOps = () => {
      if (pauses) {
        return Promise.resolve()
        .then(() => helpers.increaseTime(timeSpent / 2 * 60))
        .then(() => helpers.mine())
        .then(() => jobController.pauseWork(jobId, {from: worker}))
        .then(() => helpers.increaseTime(30 * 60))
        .then(() => helpers.mine())
        .then(() => jobController.resumeWork(jobId, {from: worker}))
        .then(() => helpers.increaseTime(timeSpent / 2 * 60))
        .then(() => helpers.mine())
      } else {
        return Promise.resolve()
        .then(() => helpers.increaseTime(timeSpent * 60))
        .then(() => helpers.mine())
      }
    }

    return Promise.resolve()
      .then(() => paymentGateway.getBalance(client, fakeCoin.address))
      .then(result => clientBalanceBefore = result)
      .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
      .then(result => workerBalanceBefore = result)
      .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
      .then(() => jobController.postJobOffer(
        jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
      ))
      .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
      .then(() => jobController.startWork(jobId, {from: worker}))
      .then(() => jobController.confirmStartWork(jobId, {from: client}))
      .then(() => timeOps())
      .then(() => jobController.endWork(jobId, {from: worker}))
      .then(() => jobController.confirmEndWork(jobId, {from: client}))
      .then(() => jobController.releasePayment(jobId))
      .then(() => assertInternalBalance(client, fakeCoin.address, clientBalanceBefore.sub(jobPaymentEstimate)))
      .then(() => assertInternalBalance(worker, fakeCoin.address, workerBalanceBefore.add(jobPaymentEstimate)))
      .then(() => assertInternalBalance(jobId, fakeCoin.address, 0));
  }

  before('setup', () => {
    return Mock.deployed()
    .then(instance => mock = instance)
    .then(() => ignoreAuth())
    .then(() => ignoreSkillsCheck())
    .then(() => FakeCoin.deployed())
    .then(instance => fakeCoin = instance)
    .then(() => MultiEventsHistory.deployed())
    .then(instance => multiEventsHistory = instance)
    .then(() => Storage.deployed())
    .then(instance => storage = instance)
    .then(() => BalanceHolder.deployed())
    .then(instance => balanceHolder = instance)
    .then(() => ERC20Library.deployed())
    .then(instance => erc20Library = instance)
    .then(() => UserLibrary.deployed())
    .then(instance => userLibrary = instance)
    .then(() => PaymentGateway.deployed())
    .then(instance => paymentGateway = instance)
    .then(() => PaymentProcessor.deployed())
    .then(instance => paymentProcessor = instance)
    .then(() => JobController.deployed())
    .then(instance => jobController = instance)
    .then(() => erc20Library.addContract(fakeCoin.address))
    .then(() => paymentGateway.setupEventsHistory(multiEventsHistory.address))
    .then(() => paymentGateway.setBalanceHolder(balanceHolder.address))
    .then(() => paymentProcessor.setPaymentGateway(paymentGateway.address))
    .then(() => jobController.setPaymentProcessor(paymentProcessor.address))
    .then(() => jobController.setUserLibrary(mock.address))
    .then(() => fakeCoin.mint(client, '0xfffffffffffffffffff'))
    .then(() => paymentGateway.deposit('0xfffffffffffffffffff', fakeCoin.address, {from: client}))
    .then(reverter.snapshot);
  });


  describe('Contract setup', () => {

    it('should check auth on setup event history', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          jobController.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            jobController.address,
            jobController.contract.setupEventsHistory.getData(newAddress).slice(0, 10)
          ), 0)
        )
        .then(() => jobController.setupEventsHistory(newAddress, {from: caller}))
        .then(assertExpectations());
    });

    it('should check auth on setting a payment processor', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          jobController.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            jobController.address,
            jobController.contract.setPaymentProcessor.getData(newAddress).slice(0, 10)
          ), 0)
        )
        .then(() => jobController.setPaymentProcessor(newAddress, {from: caller}))
        .then(assertExpectations());
    });

    it('should check auth on setting a user library', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          jobController.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            jobController.address,
            jobController.contract.setUserLibrary.getData(newAddress).slice(0, 10)
          ), 0)
        )
        .then(() => jobController.setUserLibrary(newAddress, {from: caller}))
        .then(assertExpectations());
    });

    it('should check auth on setting ERC20 library', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          jobController.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            jobController.address,
            jobController.contract.setERC20Library.getData(newAddress).slice(0, 10)
          ), 0)
        )
        .then(() => jobController.setERC20Library(newAddress, {from: caller}))
        .then(assertExpectations());
    });

  });


  describe('Job posting', () => {

    it('should NOT allow to post a job with even area mask', () => {
      const area = 2;
      const category = 4;
      const skills = 555;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it('should NOT allow to post a job with multiple area mask', () => {
      const area = 5;
      const category = 4;
      const skills = 555;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it('should NOT allow to post a job with even category mask', () => {
      const area = 1;
      const category = 2;
      const skills = 555;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it('should NOT allow to post a job with multiple category mask', () => {
      const area = 1;
      const category = 5;
      const skills = 555;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it('should NOT allow to post a job with no skills', () => {
      const area = 1;
      const category = 4;
      const skills = 0;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it.skip('should NOT allow to post a job with negative skills', () => {
      const area = 1;
      const category = 4;
      const skills = -12;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        //.then(() => jobController.getJobSkills.call(1))
        .then(asserts.equal(0));
    });

    it('should NOT allow to post a job with negative category', () => {
      const area = 1;
      const category = -4;
      const skills = 3;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it('should NOT allow to post a job with negative area', () => {
      const area = -1;
      const category = 4;
      const skills = 3;
      return Promise.resolve()
        .then(() => jobController.postJob.call(area, category, skills, "Job details"))
        .then(asserts.equal(0));
    });

    it('should allow anyone to post a job', () => {
      return Promise.each(accounts, account => {
        return jobController.postJob.call(4, 4, 4, 'Job details', {from: account})
          .then(jobId => assert.equal(jobId, 1));
      });
    });

    it('should allow to post a job several times by different users', () => {
      const clients = accounts.slice(1, 4);
      const area = 1;
      const category = 4;
      const skills = 2;
      const args = [area, category, skills, "Job details"];
      return Promise.each(clients, c => {
          return jobController.postJob(...args, {from: c})
            .then(helpers.assertLogs([{
              event: "JobPosted",
              args: {
                client: c
              }
            }]))
        })
        .then(() => jobController.getJobsCount())
        .then(asserts.equal(3));
    });

  });


  describe('Post job offer', () => {

    it('should NOT a post job offer if unsupported token contract is provided', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          1, Mock.address, '0xfffffffffffffffffff', 1, 1, {from: worker}
          )
        )
        .then(assert.isFalse);
    });

    it('should NOT a post job offer with null rate', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          1, fakeCoin.address, 0, 1, 1, {from: worker}
          )
        )
        .then(assert.isFalse);
    });

    it('should NOT a post job offer with null estimate', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          1, fakeCoin.address, '0xfffffffffffffffffff', 0, 1, {from: worker}
          )
        )
        .then(assert.isFalse);
    });

    it('should NOT post a job offer when rate/estimate/ontop overflow', () => {
      const jobId = 1;
      const rate = '0x1D1745D1745D1745D1745D1745D1745D1745D1745D1745D1745D1745D1745D1';
      const estimate = 68;
      const ontop = 60;
      /**
       * With these values,  ((rate * (estimate + 60) + ontop) / 10) * 11  will equal (uint256 + 3)
       */
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          jobId, fakeCoin.address, rate, estimate, ontop, {from: worker}
          )
        )
        .then(assert.isFalse);
    });

    it('should allow to post a job offer when lock amount is almost the maximum uint256 value', () => {
      const jobId = 1;
      const rate = '0x1D1745D1745D1745D1745D1745D1745D1745D1745D1745D1745D1745D1745D1';
      const estimate = 68;
      const ontop = 59;
      /**
       * With these values,  ((rate * (estimate + 60) + ontop) / 10) * 11  will equal near the uint256 value
       */
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          jobId, fakeCoin.address, rate, estimate, ontop, {from: worker}
          )
        )
        .then(assert.isTrue);
    });

    it("should check skills on posting job offer", () => {
      return jobController.postJob(4, 4, 4, 'Job details', {from: client})
        .then(() => ignoreSkillsCheck(false))
        .then(() => mock.expect(
          jobController.address,
          0,
          userLibraryInterface.hasSkills.getData(
            worker, 4, 4, 4
          ),
          0
        ))
        .then(() => jobController.postJobOffer(1, fakeCoin.address, 1000, 180, 1000, {from: worker}))
        .then(assertExpectations());
    });

    it("should NOT post job offer if worker skills does not match", () => {
      return jobController.setUserLibrary(userLibrary.address)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          1, fakeCoin.address, 1000, 180, 1000, {from: worker})
        )
        .then(assert.isFalse);
    });

    it('should NOT allow to post a job offer to yourself', () => {
      const jobId = 1;
      const jobArea = 4;
      const jobCategory = 4;
      const jobSkills = 4;
      const jobDetails = 'Job details';
      const additionalTime = 60;
      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;

      return Promise.resolve()
        .then(() => jobController.postJob(jobArea, jobCategory, jobSkills, jobDetails, {from: client}))
        .then(() => jobController.postJobOffer.call(jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: client}))
        .then(assert.isFalse);
    });

    it("should allow to post job offer with no ontop payment", () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer.call(
          1, fakeCoin.address, '0xfffffffffffffffffff', 1, 0, {from: worker}
          )
        )
        .then(assert.isTrue);
    });

    it("should post job offer if worker skills match", () => {
      return Promise.resolve()
        .then(() => jobController.setUserLibrary(userLibrary.address))
        .then(() => jobController.postJob(16, 1, 1, 'Job details', {from: client}))
        .then(() => userLibrary.setMany(worker, 16, [1], [1]))
        .then(() => jobController.postJobOffer.call(
          1, fakeCoin.address, 1000, 180, 1000, {from: worker})
        )
        .then(assert.isTrue);
    });

    it('should allow to post multiple job offers to one job', () => {
      const workers = accounts.slice(1, 4);
      const jobId = 1;
      const jobArea = 4;
      const jobCategory = 4;
      const jobSkills = 4;
      const jobDetails = 'Job details';
      const workerRate = 55;
      const workerOnTop = 55;
      const jobEstimate = 180;
      const args = [jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop];
      return Promise.resolve()
        .then(() => jobController.postJob(
          jobArea, jobCategory, jobSkills, jobDetails, {from: client}
        ))
        .then(() => {
          return Promise.each(workers, w => {
            return jobController.postJobOffer(...args, {from: w})
              .then(tx => helpers.assertLogs(tx, [{
                address: multiEventsHistory.address,
                event: "JobOfferPosted",
                args: {
                  self: jobController.address,
                  jobId: jobId,
                  worker: w
                }
              }]));
          })
        });
    });

  });


  describe('Accept job offer', () => {

    it('should NOT accept job offer for non-existent job worker', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.acceptOffer.call(1, worker, {from: client}))
        .then(assert.isFalse);
    });

    it('should THROW on `acceptOffer` if client has insufficient funds', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, '0xfffffffffffffffffff', 1, 1, {from: worker}
          )
        )
        .then(() => asserts.throws(
          jobController.acceptOffer(1, worker, {from: client})
        ));
    });

    it('should THROW when trying to accept job offer if payment lock was not ' +
       'allowed in Payment Processor', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, '0x12f2a36ecd555', 1, '0x12f2a36ecd555', {from: worker}
          )
        )
        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)
        .then(() => asserts.throws(
          jobController.acceptOffer(1, worker, {from: client})
        ));
    });

    it('should allow to accept job offer if payment lock was allowed by Payment Processor', () => {
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, '0x12f2a36ecd555', 1, '0x12f2a36ecd555', {from: worker}
          )
        )
        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)
        .then(() => paymentProcessor.approve(1))
        .then(() => jobController.acceptOffer.call(1, worker, {from: client}))
        .then(assert.isTrue);
    });

    it('should lock correct amount of tokens on `acceptOffer`', () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      const estimatedLockAmount = Math.floor(
        ((workerRate * (jobEstimate + 60) + workerOnTop) / 10) * 11
      );

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => {
          const clientBalanceAfter = clientBalanceBefore.sub(estimatedLockAmount);
          assert.equal(result.toString(), clientBalanceAfter.toString())
        })
        .then(() => paymentGateway.getBalance(jobId, fakeCoin.address))
        .then(result => assert.equal(result.toString(), estimatedLockAmount.toString()))
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => assert.equal(result.toString(), workerBalanceBefore.toString()));
    });

  });


  describe('Job status and caller restrictions', () => {

    it('should NOT allow to call all client-worker workflow methods not by these guys', () => {
      const jobId = 1;
      const jobArea = 4;
      const jobCategory = 4;
      const jobSkills = 4;
      const jobDetails = 'Job details';
      const additionalTime = 60;
      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;

      return Promise.resolve()
        .then(() => jobController.postJob(jobArea, jobCategory, jobSkills, jobDetails, {from: client}))
        .then(() => jobController.postJobOffer(jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}))
        .then(() => jobController.acceptOffer.call(jobId, worker, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.cancelJob.call(jobId, {from: client}))
        .then(assert.isTrue)
        .then(() => jobController.cancelJob.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.startWork.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.startWork(jobId, {from: worker}))
        .then(() => jobController.cancelJob.call(jobId, {from: client}))
        .then(assert.isTrue)
        .then(() => jobController.cancelJob.call(jobId, {from: stranger}))
        .then(assert.isFalse)

        .then(() => jobController.confirmStartWork.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.confirmStartWork(jobId, {from: client}))
        .then(() => jobController.cancelJob.call(jobId, {from: client}))
        .then(assert.isTrue)
        .then(() => jobController.cancelJob.call(jobId, {from: stranger}))
        .then(assert.isFalse)

        .then(() => jobController.pauseWork.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.pauseWork(jobId, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkPaused"))
        .then(events => assert.equal(events.length, 1))

        .then(() => jobController.resumeWork.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.resumeWork(jobId, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkResumed"))
        .then(events => assert.equal(events.length, 1))

        .then(() => jobController.addMoreTime.call(jobId, additionalTime, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.addMoreTime(jobId, additionalTime, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "TimeAdded"))
        .then(events => assert.equal(events.length, 1))

        .then(() => jobController.endWork.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.endWork(jobId, {from: worker}))
        .then(() => jobController.cancelJob.call(jobId, {from: client}))
        .then(assert.isTrue)
        .then(() => jobController.cancelJob.call(jobId, {from: stranger}))
        .then(assert.isFalse)

        .then(() => jobController.confirmEndWork.call(jobId, {from: stranger}))
        .then(assert.isFalse)
        .then(() => jobController.confirmEndWork(jobId, {from: client}))

        .then(() => jobController.releasePayment(jobId))
        .then(() => jobController.getJobState(jobId))
        .then(asserts.equal(7));
    });

    it('should allow anyone to post an offer for a job only when a job has CREATED status', () => {
      const operation = jobController.postJobOffer;
      const args = [1, FakeCoin.address, '0x12F2A36ECD555', 180, '0x12F2A36ECD555', {from: worker}];
      const results = {CREATED: true};
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should allow assigned worker to request work start only when a job has ACCEPTED status', () => {
      const operation = jobController.startWork;
      const args = [1, {from: worker}];
      const results = {ACCEPTED: true};
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should allow client to confirm start work only when job has PENDING_START status', () => {
      const operation = jobController.confirmStartWork;
      const args = [1, {from: client}];
      const results = {PENDING_START: true};
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should allow assigned worker to request end work only when job has STARTED status', () => {
      const operation = jobController.endWork;
      const args = [1, {from: worker}];
      const results = {STARTED: true};
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should allow client to confirm end work only when job has PENDING_FINISH status', () => {
      const operation = jobController.confirmEndWork;
      const args = [1, {from: client}];
      const results = {PENDING_FINISH: true};
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should allow anyone to release payment only when job has FINISHED status', () => {
      const operation = jobController.releasePayment;
      const args = [1, {from: accounts[3]}];
      const results = {FINISHED: true};
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should allow client to cancel job only at ACCEPTED, PENDING_START, STARTED and PENDING_FINISH states', () => {
      const operation = jobController.cancelJob;
      const args = [1, {from: client}];
      const results = {
        ACCEPTED: true,
        PENDING_START: true,
        STARTED: true,
        PENDING_FINISH: true
      };
      return Promise.resolve()
        .then(() => operationAllowance(operation, args, results));
    });

    it('should NOT allow to cancel job if it was agreed as FINISHED', () => {
      const jobId = 1;
      const jobArea = 4;
      const jobCategory = 4;
      const jobSkills = 4;
      const jobDetails = 'Job details';

      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;

      return Promise.resolve()
      .then(() => jobController.postJob(jobArea, jobCategory, jobSkills, jobDetails, {from: client}))

      .then(() => jobController.postJobOffer(jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}))
      .then(() => jobController.acceptOffer(jobId, worker, {from: client}))

      .then(() => jobController.startWork(jobId, {from: worker}))

      .then(() => jobController.confirmStartWork(jobId, {from: client}))

      .then(() => jobController.endWork(1, {from: worker}))

      .then(() => jobController.confirmEndWork(jobId, {from: client}))

      .then(() => jobController.getJobState(jobId))
      .then(asserts.equal(6))
      .then(() => jobController.cancelJob.call(jobId, {from: client}))
      .then(assert.isFalse);

    });

  });


  describe('Time adjustments', () => {

    it("should NOT allow to pause work if it's already paused", () => {
      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 7, 'Job details', {from: client}))

        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(() => jobController.startWork(1, {from: worker}))
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(() => jobController.pauseWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkPaused"))
        .then(events => assert.equal(events.length, 1))
        .then(() => jobController.pauseWork.call(1, {from: worker}))
        .then(assert.isFalse);
    });

    it("should NOT allow to resume work if it isn't paused", () => {
      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 7, 'Job details', {from: client}))

        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(() => jobController.startWork(1, {from: worker}))
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(() => jobController.resumeWork.call(1, {from: worker}))
        .then(assert.isFalse);
    });

    it("should NOT add null amount of work time", () => {
      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 7, 'Job details', {from: client}))

        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(() => jobController.startWork(1, {from: worker}))
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(() => jobController.addMoreTime.call(1, 0, {from: client}))
        .then(assert.isFalse);
    });

    it("should THROW when trying to add more time if operation " +
       "is not allowed by Payment Processor", () => {
      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 7, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(() => jobController.startWork(1, {from: worker}))
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkStarted"))
        .then(events => assert.equal(events.length, 1))
        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)
        .then(() => asserts.throws(
          jobController.addMoreTime(1, 60, {from: client})
        ));
    });

    it("should NOT let client add more work time if he doesn't have enough funds for it", () => {
      const workerRate = '0xffffffffffffffff';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 7, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(() => jobController.startWork(1, {from: worker}))
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkStarted"))
        .then(events => assert.equal(events.length, 1))
        .then(() => asserts.throws(
          jobController.addMoreTime(1, 65535, {from: client})
        ));
    });

  });


  describe('Events', () => {

    it('should emit all events on a workflow with completed job', () => {
      const skillsArea = '4';
      const skillsCategory = '4';
      const skills = '555';
      const jobDetails = "Job details";

      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;

      return Promise.resolve()
      // Post job
        .then(() => jobController.postJob(skillsArea, skillsCategory, skills, jobDetails, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "JobPosted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobPosted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.client, client);
          assert.equal(log.skillsArea.toString(), skillsArea);
          assert.equal(log.skillsCategory.toString(), skillsCategory);
          assert.equal(log.skills.toString(), skills);
          // TODO: handle hash matches
        })
        // Post job offer
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
          )
        )
        .then(tx => eventsHelper.extractEvents(tx, "JobOfferPosted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobOfferPosted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.worker, worker);
          assert.equal('0x' + log.rate.toString(16), workerRate);
          assert.equal(log.estimate.toString(), jobEstimate);
          assert.equal('0x' + log.ontop.toString(16), workerOnTop);
        })
        // Accept job offer
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "JobOfferAccepted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobOfferAccepted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.worker, worker);
        })
        // Request start of work
        .then(() => jobController.startWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkStarted"))
        .then(events => assert.equal(events.length, 0))
        // Confirm start of work
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkStarted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkStarted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        // Pause work
        .then(() => jobController.pauseWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkPaused"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkPaused');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        // Resume work
        .then(() => jobController.resumeWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkResumed"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkResumed');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        // Add more time
        .then(() => jobController.addMoreTime(1, 60, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "TimeAdded"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'TimeAdded');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.time.toString(), '60');
        })
        // Request end of work
        .then(() => jobController.endWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkFinished"))
        .then(events => assert.equal(events.length, 0))
        // Confirm end of work
        .then(() => jobController.confirmEndWork(1, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkFinished"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkFinished');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        .then(() => jobController.releasePayment(1))
        .then(tx => eventsHelper.extractEvents(tx, "PaymentReleased"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'PaymentReleased');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        });
    });

    it('should emit all events on a workflow with canceled job', () => {
      const skillsArea = '4';
      const skillsCategory = '4';
      const skills = '555';
      const jobDetails = "Job details";

      const workerRate = '0x12f2a36ecd555';
      const workerOnTop = '0x12f2a36ecd555';
      const jobEstimate = 180;

      return Promise.resolve()
      // Post job
        .then(() => jobController.postJob(skillsArea, skillsCategory, skills, jobDetails, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "JobPosted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobPosted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.client, client);
          assert.equal(log.skillsArea.toString(), skillsArea);
          assert.equal(log.skillsCategory.toString(), skillsCategory);
          assert.equal(log.skills.toString(), skills);
          // TODO: handle hash matches
        })
        // Post job offer
        .then(() => jobController.postJobOffer(
          1, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
          )
        )
        .then(tx => eventsHelper.extractEvents(tx, "JobOfferPosted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobOfferPosted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.worker, worker);
          assert.equal('0x' + log.rate.toString(16), workerRate);
          assert.equal(log.estimate.toString(), jobEstimate);
          assert.equal('0x' + log.ontop.toString(16), workerOnTop);
        })
        // Accept job offer
        .then(() => jobController.acceptOffer(1, worker, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "JobOfferAccepted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobOfferAccepted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.worker, worker);
        })
        // Request start of work
        .then(() => jobController.startWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkStarted"))
        .then(events => assert.equal(events.length, 0))
        // Confirm start of work
        .then(() => jobController.confirmStartWork(1, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkStarted"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkStarted');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        // Pause work
        .then(() => jobController.pauseWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkPaused"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkPaused');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        // Resume work
        .then(() => jobController.resumeWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "WorkResumed"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'WorkResumed');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        })
        // Add more time
        .then(() => jobController.addMoreTime(1, 60, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "TimeAdded"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'TimeAdded');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
          assert.equal(log.time.toString(), '60');
        })
        // Request end of work
        .then(() => jobController.endWork(1, {from: worker}))
        .then(tx => eventsHelper.extractEvents(tx, "JobCanceled"))
        .then(events => assert.equal(events.length, 0))
        // Cancel job
        .then(() => jobController.cancelJob(1, {from: client}))
        .then(tx => eventsHelper.extractEvents(tx, "JobCanceled"))
        .then(events => {
          assert.equal(events.length, 1);
          assert.equal(events[0].address, multiEventsHistory.address);
          assert.equal(events[0].event, 'JobCanceled');
          const log = events[0].args;
          assert.equal(log.self, jobController.address);
          assert.equal(log.jobId.toString(), '1');
        });
    });

  });


  describe('Reward release', () => {

    it("should NOT allow to cancel job if operation " +
       "was not allowed by Payment Processor", () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)
        .then(() => jobController.cancelJob.call(jobId, {from: client}))
        .then(assert.isFalse);
    });

    it("should allow to cancel job if operation " +
       "was allowed by Payment Processor", () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)
        .then(() => paymentProcessor.approve(jobId))
        .then(() => jobController.cancelJob.call(jobId, {from: client}))
        .then(assert.isTrue);
    });

    it("should NOT allow to release payment when operation was not allowed by Payment Processor", () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.startWork(jobId, {from: worker}))
        .then(() => jobController.confirmStartWork(jobId, {from: client}))
        .then(() => jobController.endWork(jobId, {from: worker}))
        .then(() => jobController.confirmEndWork(jobId, {from: client}))

        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)

        .then(() => jobController.releasePayment.call(jobId))
        .then(assert.isFalse)
    });

    it("should allow to release payment when operation was allowed by Payment Processor", () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      return Promise.resolve()
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.startWork(jobId, {from: worker}))
        .then(() => jobController.confirmStartWork(jobId, {from: client}))
        .then(() => jobController.endWork(jobId, {from: worker}))
        .then(() => jobController.confirmEndWork(jobId, {from: client}))

        .then(() => paymentProcessor.enableServiceMode())
        .then(() => paymentProcessor.serviceMode())
        .then(assert.isTrue)
        .then(() => paymentProcessor.approve(jobId))

        .then(() => jobController.releasePayment.call(jobId))
        .then(assert.isTrue)
    });

    it('should release just jobOfferOnTop on `cancelJob` on ACCEPTED job stage', () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.cancelJob(jobId, {from: client}))
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => assert.equal(result.toString(), clientBalanceBefore.sub(workerOnTop).toString()))
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => assert.equal(result.toString(), workerBalanceBefore.add(workerOnTop).toString()))
        .then(() => paymentGateway.getBalance(jobId, fakeCoin.address))
        .then(result => assert.equal(result.toString(), '0'));
    });

    it('should release just jobOfferOnTop on `cancelJob` on PENDING_START job stage', () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.startWork(jobId, {from: worker}))
        .then(() => jobController.cancelJob(jobId, {from: client}))
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => assert.equal(result.toString(), clientBalanceBefore.sub(workerOnTop).toString()))
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => assert.equal(result.toString(), workerBalanceBefore.add(workerOnTop).toString()))
        .then(() => paymentGateway.getBalance(jobId, fakeCoin.address))
        .then(result => assert.equal(result.toString(), '0'));
    });

    it('should release jobOfferOnTop + 1 hour of work on `cancelJob` on STARTED job stage', () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      const jobPaymentEstimate = workerRate * 60 + workerOnTop;

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.startWork(jobId, {from: worker}))
        .then(() => jobController.confirmStartWork(jobId, {from: client}))
        .then(() => jobController.cancelJob(jobId, {from: client}))
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => assert.equal(result.toString(), clientBalanceBefore.sub(jobPaymentEstimate).toString()))
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => assert.equal(result.toString(), workerBalanceBefore.add(jobPaymentEstimate).toString()))
        .then(() => paymentGateway.getBalance(jobId, fakeCoin.address))
        .then(result => assert.equal(result.toString(), '0'));
    });

    it('should release jobOfferOnTop + 1 hour of work on `cancelJob` on PENDING_FINISH job stage', () => {
      const jobId = 1;
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;

      let clientBalanceBefore;
      let workerBalanceBefore;

      const jobPaymentEstimate = workerRate * 60 + workerOnTop;

      return Promise.resolve()
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => clientBalanceBefore = result)
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => workerBalanceBefore = result)
        .then(() => jobController.postJob(4, 4, 4, 'Job details', {from: client}))
        .then(() => jobController.postJobOffer(
          jobId, fakeCoin.address, workerRate, jobEstimate, workerOnTop, {from: worker}
        ))
        .then(() => jobController.acceptOffer(jobId, worker, {from: client}))
        .then(() => jobController.startWork(jobId, {from: worker}))
        .then(() => jobController.confirmStartWork(jobId, {from: client}))
        .then(() => jobController.endWork(jobId, {from: worker}))
        .then(() => jobController.cancelJob(jobId, {from: client}))
        .then(() => paymentGateway.getBalance(client, fakeCoin.address))
        .then(result => assert.equal(result.toString(), clientBalanceBefore.sub(jobPaymentEstimate).toString()))
        .then(() => paymentGateway.getBalance(worker, fakeCoin.address))
        .then(result => assert.equal(result.toString(), workerBalanceBefore.add(jobPaymentEstimate).toString()))
        .then(() => paymentGateway.getBalance(jobId, fakeCoin.address))
        .then(result => assert.equal(result.toString(), '0'));
    });


    it('should release correct amount of tokens on `releasePayment` when worked for exactly the estimated time', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = jobEstimate;
      const jobPaymentEstimate = workerRate * timeSpent + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate);
    });

    it('should release correct amount of tokens on `releasePayment` when' +
       'worked for more than an hour but less than estimated time', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 183;
      const jobPaymentEstimate = workerRate * timeSpent + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate);
    });

    it('should release correct amount of tokens on `releasePayment` when' +
       'worked for more than estimated time but less than estimated time and an hour', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 299;
      const jobPaymentEstimate = workerRate * timeSpent + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate);
    });

    it('should release possible maximum of tokens(estimate + 1 hour)' +
       'when worked for more than estimate and an hour', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 340;
      const jobPaymentEstimate = workerRate * (jobEstimate + 60) + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate);
    });

    it('should release minimum an hour of work on `releasePayment` when worked for less than an hour', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 17;
      const jobPaymentEstimate = workerRate * 60 + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate);
    });


    it('should release correct amount of tokens on `releasePayment` ' +
       'when worked for exactly the estimated time, with pauses/resumes', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 183;
      const jobPaymentEstimate = workerRate * timeSpent + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate, true);
    });

    it('should release correct amount of tokens on `releasePayment` when' +
       'worked for more than an hour but less than estimated time, with pauses/resumes', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 183;
      const jobPaymentEstimate = workerRate * timeSpent + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate, true);
    });

    it('should release correct amount of tokens on `releasePayment` when' +
       'worked for more than estimated time but less than estimated time and an hour, with pauses/resumes', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 299;
      const jobPaymentEstimate = workerRate * timeSpent + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate, true);
    });

    it('should release possible maximum of tokens(estimate + 1 hour)' +
       'when worked for more than estimate and an hour, with pauses/resumes', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 340;
      const jobPaymentEstimate = workerRate * (jobEstimate + 60) + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate, true);
    });

    it('should release minimum an hour of work on `releasePayment`' +
       'when worked for less than an hour, with pauses/resumes', () => {
      const workerRate = 200000000000;
      const workerOnTop = 1000000000;
      const jobEstimate = 240;
      const timeSpent = 17;
      const jobPaymentEstimate = workerRate * 60 + workerOnTop;
      return onReleasePayment(timeSpent, jobPaymentEstimate, true);
    });

  });


});
