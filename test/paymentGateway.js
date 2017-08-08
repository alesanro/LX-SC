"use strict";

const BalanceHolder = artifacts.require('./BalanceHolder.sol');
const FakeCoin = artifacts.require('./FakeCoin.sol');
const ERC20Library = artifacts.require('./ERC20Library.sol');
const ManagerMock = artifacts.require('./ManagerMock.sol');
const Mock = artifacts.require('./Mock.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const Roles2LibraryInterface = artifacts.require('./Roles2LibraryInterface.sol');
const Storage = artifacts.require('solidity-storage-lib/contracts/Storage.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');

const helpers = require('./helpers/helpers');


contract('PaymentGateway', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);
  let storage;
  let multiEventsHistory;
  let erc20Library;
  let fakeCoin;
  let paymentGateway;
  let balanceHolder;
  let paymentProcessor = accounts[5];
  let roles2LibraryInterface = web3.eth.contract(Roles2LibraryInterface.abi).at('0x0');
  let mock;

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
    return mock.ignore(roles2LibraryInterface.canCall.getData().slice(0, 10), enabled);
  };

  const assertInternalBalance = (address, coinAddress, expectedValue, hex=false) => {
    return (actualValue) => {
      if (!hex) {
        return paymentGateway.getBalance(address, coinAddress)
          .then(asserts.equal(expectedValue));
      } else {
        return paymentGateway.getBalance(address, coinAddress)
          .then(result => assert.equal('0x'+result.toString(16), expectedValue))
      }
    };
  };

  const assertExternalBalance = (address, coinAddress, expectedValue, hex=false) => {
    return (actualValue) => {
      if (!hex) {
        return paymentGateway.getBalanceOf(address, coinAddress)
          .then(asserts.equal(expectedValue));
      } else {
        return paymentGateway.getBalanceOf(address, coinAddress)
          .then(result => assert.equal('0x'+result.toString(16), expectedValue))
      }
    };
  };

  const error = (tx, text) => {
    helpers.error(
      tx, multiEventsHistory, paymentGateway, text
    );
  }

  function transferToMany(
    actualSender, to, values, receiver1Result, receiver2Result,
    senderResult, balanceHolderResult, throws, check, checkArgs
  ) {
    const sender = accounts[6];
    const receiver1 = accounts[7];
    const receiver2 = accounts[8];
    const value = 1000;
    return Promise.resolve()
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => {
        if (throws) {
          return asserts.throws(
            paymentGateway.transferToMany(
              actualSender, to, values, 0, 0, fakeCoin.address, {from: paymentProcessor}
            )
          )
        } else {
          return paymentGateway.transferToMany(
            actualSender, to, values, 0, 0, fakeCoin.address, {from: paymentProcessor}
          )
        }
      })
      .then(result => {
        if (typeof check !== 'undefined') {
          check(result, ...checkArgs);
        }
      })
      .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
      .then(assertInternalBalance(sender, fakeCoin.address, senderResult))

      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balanceHolderResult))
      .then(assertExternalBalance(receiver1, fakeCoin.address, 0))
      .then(assertExternalBalance(receiver2, fakeCoin.address, 0))
      .then(assertExternalBalance(sender, fakeCoin.address, 0))
  }

  function transferFromMany(
    from, actualReceiver, values, sender1Result, sender2Result,
    receiverResult, balanceHolderResult, throws, check, checkArgs,
    preOps, preOpsArgs
  ) {
    const sender1 = accounts[6];
    const sender2 = accounts[7];
    const receiver = accounts[8];
    const value1 = 1000;
    const value2 = 200;
    return Promise.resolve()
      .then(() => fakeCoin.mint(sender1, value1))
      .then(() => fakeCoin.mint(sender2, value2))
      .then(() => paymentGateway.deposit(value1, fakeCoin.address, {from: sender1}))
      .then(() => paymentGateway.deposit(value2, fakeCoin.address, {from: sender2}))
      .then(() => {
        if (typeof preOps !== 'undefined') {
          return preOps(...preOpsArgs);
        }
      })
      .then(() => {
        if (throws) {
          return asserts.throws(
            paymentGateway.transferFromMany(
              from, actualReceiver, values, fakeCoin.address, {from: paymentProcessor}
            )
          )
        } else {
          return paymentGateway.transferFromMany(
            from, actualReceiver, values, fakeCoin.address, {from: paymentProcessor}
          )
        }
      })
      .then(result => {
        if (typeof check !== 'undefined') {
          check(result, ...checkArgs);
        }
      })
      .then(assertInternalBalance(sender1, fakeCoin.address, sender1Result))
      .then(assertInternalBalance(sender2, fakeCoin.address, sender2Result))
      .then(assertInternalBalance(receiver, fakeCoin.address, receiverResult))

      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balanceHolderResult))
      .then(assertExternalBalance(sender1, fakeCoin.address, 0))
      .then(assertExternalBalance(sender2, fakeCoin.address, 0))
      .then(assertExternalBalance(receiver, fakeCoin.address, 0));
  }

  before('setup', () => {
    return Mock.deployed()
    .then(instance => mock = instance)
    .then(() => ignoreAuth())
    .then(() => Storage.deployed())
    .then(instance => storage = instance)
    .then(() => ManagerMock.deployed())
    .then(instance => storage.setManager(instance.address))
    .then(() => BalanceHolder.deployed())
    .then(instance => balanceHolder = instance)
    .then(() => FakeCoin.deployed())
    .then(instance => fakeCoin = instance)
    .then(() => ERC20Library.deployed())
    .then(instance => erc20Library = instance)
    .then(() => PaymentGateway.deployed())
    .then(instance => paymentGateway = instance)
    .then(() => MultiEventsHistory.deployed())
    .then(instance => multiEventsHistory = instance)
    .then(() => erc20Library.setupEventsHistory(multiEventsHistory.address))
    .then(() => erc20Library.addContract(fakeCoin.address))

    .then(() => paymentGateway.setupEventsHistory(multiEventsHistory.address))
    .then(() => paymentGateway.setBalanceHolder(balanceHolder.address))

    .then(() => multiEventsHistory.authorize(paymentGateway.address))
    .then(reverter.snapshot);
  });


  describe("Contract setup", () => {

    it('should check auth on setup events history', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            paymentGateway.address,
            paymentGateway.contract.setupEventsHistory.getData().slice(0, 10)
          ), 0)
        )
        .then(() => paymentGateway.setupEventsHistory(newAddress, {from: caller}))
        .then(assertExpectations());
    });

    it('should check auth on setting ERC20 library', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            paymentGateway.address,
            paymentGateway.contract.setERC20Library.getData().slice(0, 10)
          ), 0)
        )
        .then(() => paymentGateway.setERC20Library(newAddress, {from: caller}))
        .then(assertExpectations());
    });

    it('should check auth on setting balance holder', () => {
      const caller = accounts[1];
      const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            paymentGateway.address,
            paymentGateway.contract.setBalanceHolder.getData().slice(0, 10)
          ), 0)
        )
        .then(() => paymentGateway.setBalanceHolder(newAddress, {from: caller}))
        .then(assertExpectations());
    });

    it('should check auth on setting fee address', () => {
      const caller = accounts[1];
      const feeAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            caller,
            paymentGateway.address,
            paymentGateway.contract.setFeeAddress.getData().slice(0, 10)
          ), 0)
        )
        .then(() => paymentGateway.setFeeAddress(feeAddress, {from: caller}))
        .then(assertExpectations())
        .then(() => paymentGateway.getFeeAddress())
        .then(asserts.equal('0x0000000000000000000000000000000000000000'));
    });

    it('should set fee address', () => {
      const feeAddress = '0xffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => paymentGateway.getFeeAddress())
      .then(asserts.equal(feeAddress));
    });

    it('should check auth on setting fee percent', () => {
      const caller = accounts[1];
      const feePercent = 1333;
      return Promise.resolve()
      .then(() => ignoreAuth(false))
      .then(() => mock.expect(
        paymentGateway.address,
        0,
        roles2LibraryInterface.canCall.getData(
          caller,
          paymentGateway.address,
          paymentGateway.contract.setFeePercent.getData().slice(0, 10)
        ), 0)
      )
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address, {from: caller}))
      .then(assertExpectations())
      .then(() => paymentGateway.getFeePercent(fakeCoin.address))
      .then(asserts.equal(0));
    });

    it('should set fee percent', () => {
      const feePercent = 1333;
      return Promise.resolve()
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => paymentGateway.getFeePercent(fakeCoin.address))
      .then(asserts.equal(feePercent));
    });

    it('should NOT set fee percent for not supported contract', () => {
      const feePercent = 1333;
      const notSupported = '0x00000000000000000000000000000000000000ff';
      return Promise.resolve()
      .then(() => paymentGateway.setFeePercent(feePercent, notSupported))
      .then(() => paymentGateway.getFeePercent(notSupported))
      .then(asserts.equal(0));
    });

    it('should set fee percent for different contracts', () => {
      const feePercent = 1333;
      const feePercent2 = 1;
      const supported2 = '0x00000000000000000000000000000000000000ff';
      return Promise.resolve()
      .then(() => erc20Library.addContract(supported2))
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => paymentGateway.setFeePercent(feePercent2, supported2))
      .then(() => paymentGateway.getFeePercent(fakeCoin.address))
      .then(asserts.equal(feePercent))
      .then(() => paymentGateway.getFeePercent(supported2))
      .then(asserts.equal(feePercent2));
    });

    it('should emit FeeSet event in MultiEventsHistory', () => {
      const feePercent = 1333;
      return Promise.resolve()
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(result => {
        assert.equal(result.logs.length, 1);
        assert.equal(result.logs[0].address, multiEventsHistory.address);
        assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
        assert.equal(result.logs[0].args.feePercent, 1333);
        assert.equal(result.logs[0].args.self, paymentGateway.address);
      });
    });

    it('should NOT set fee percent higher than or equal to 100%', () => {
      const feePercent = 10000;
      return Promise.resolve()
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => paymentGateway.getFeePercent(fakeCoin.address))
      .then(asserts.equal(0))
      .then(() => paymentGateway.setFeePercent(feePercent - 1, fakeCoin.address))
      .then(() => paymentGateway.getFeePercent(fakeCoin.address))
      .then(asserts.equal(feePercent - 1));
    });

  });


  describe("Deposit", () => {

    it('should NOT deposit if given ERC20 contract is not supported', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, value))
    });

    it('should THROW on deposit when value overflow occurs', () => {
      const sender = accounts[6];
      const value = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.mint(sender, 1))
        .then(() => asserts.throws(
          paymentGateway.deposit(1, fakeCoin.address, {from: sender}))
        )
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value, true));
    });

    it('should NOT deposit no tokens', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(0, fakeCoin.address, {from: sender}))
        .then(tx => error(tx, "Value is empty"))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, value))
        .then(assertInternalBalance(sender, fakeCoin.address, 0));
    });

    it('should NOT deposit if sender has not ' +
       'enough tokens at the target contract', () => {
      const sender = accounts[6];
      const balance = 999;
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(tx => error(tx, "Not enough balance to deposit"))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, balance));
    });

    it('should NOT deposit if sender has not given ' +
       'allowance to transfer his tokens to balanceHolder', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.enableApproval())
        .then(() => fakeCoin.approvalMode())
        .then(assert.isTrue)
        .then(() => paymentGateway.deposit(
          value, fakeCoin.address, {from: sender})
        )
        .then(tx => error(tx, "Deposit failed"))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, value));
    });

    it('should deposit if sender has given ' +
       'allowance to transfer his tokens to balanceHolder', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.enableApproval())
        .then(() => fakeCoin.approvalMode())
        .then(assert.isTrue)
        .then(() => fakeCoin.approve(balanceHolder.address, value, {from: sender}))
        .then(() => paymentGateway.deposit.call(
          value, fakeCoin.address, {from: sender})
        )
        .then(assert.isTrue);
    });

    it('should deposit', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0));
    });

    it('should emit Deposited event in MultiEventsHistory', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(result => {
          assert.equal(result.logs.length, 1);
          assert.equal(result.logs[0].address, multiEventsHistory.address);
          assert.equal(result.logs[0].event, 'Deposited');
          assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[0].args.by, sender);
          assert.equal(result.logs[0].args.value.valueOf(), value);
        });
    });

    it('should deposit only credited amount', () => {
      const sender = accounts[6];
      const value = 1000;
      const fee = 100;
      const result = 900;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.setFee(fee))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.getBalance(sender, fakeCoin.address))
        .then(asserts.equal(result))
        .then(() => fakeCoin.balanceOf(balanceHolder.address))
        .then(asserts.equal(result))
        .then(() => fakeCoin.balanceOf(sender))
        .then(asserts.equal(0));
    });

  });


  describe("Withdraw", () => {

    it('should NOT withdraw no tokens', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.withdraw(0, fakeCoin.address, {from: sender}))
        .then(tx => error(tx, "Value is empty"))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0));
    });

    it('should THROW on withdraw when value underflow occurs', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.transferFrom(balanceHolder.address, '0x0', 1))
        .then(() => asserts.throws(
          paymentGateway.withdraw(value, fakeCoin.address, {from: sender}))
        )
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value - 1))
        .then(assertExternalBalance(sender, fakeCoin.address, 0));
    });

    it('should NOT allow to withdraw more than is deposited', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.withdraw(value + 1, fakeCoin.address, {from: sender}))
        .then(tx => error(tx, "Not enough balance to withdraw"))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0));
    });

    it('should NOT withdraw if withdrawal failed in ERC20 contract', () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.enableMaintenance())
        .then(() => paymentGateway.withdraw(value, fakeCoin.address, {from: sender}))
        .then(tx => error(tx, "Withdrawal failed"))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0));
    })

    it('should THROW on withdraw if whole charged amount ' +
       '(with fee) is greater than user balance', () => {
      const sender = accounts[6];
      const value = 1000;
      const withdraw = 1000;
      const fee = 100;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.mint(balanceHolder.address, fee))
        .then(() => fakeCoin.setFee(fee))
        .then(() => fakeCoin.setFeeFromPayer())
        .then(() => asserts.throws(
          paymentGateway.withdraw(withdraw, fakeCoin.address, {from: sender}))
        )
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value + fee))
        .then(assertExternalBalance(sender, fakeCoin.address, 0));
    });

    it("should withdraw part of the sender's tokens", () => {
      const sender = accounts[6];
      const value = 1000;
      const withdraw = 300;
      const result = 700;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.withdraw(withdraw, fakeCoin.address, {from: sender}))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, result))
        .then(assertExternalBalance(sender, fakeCoin.address, withdraw));
    });

    it("should withdraw all of the sender's tokens", () => {
      const sender = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.withdraw(value, fakeCoin.address, {from: sender}))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, value));
    });

    it('should emit Withdrawn event in MultiEventsHistory', () => {
      const sender = accounts[6];
      const value = 1000;
      const withdraw = 300;
      const result = 700;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.withdraw(withdraw, fakeCoin.address, {from: sender}))
        .then(result => {
          assert.equal(result.logs.length, 1);
          assert.equal(result.logs[0].address, multiEventsHistory.address);
          assert.equal(result.logs[0].event, 'Withdrawn');
          assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[0].args.by, sender);
          assert.equal(result.logs[0].args.value.valueOf(), withdraw);
        });
    });

    it('should withdraw whole charged amount (with fee)', () => {
      const sender = accounts[6];
      const value = 1000;
      const withdraw = 300;
      const fee = 100;
      const result = 600;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.setFee(fee))
        .then(() => fakeCoin.setFeeFromPayer())
        .then(() => paymentGateway.withdraw(withdraw, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.getBalance(sender, fakeCoin.address))
        .then(asserts.equal(result))
        .then(() => fakeCoin.balanceOf(balanceHolder.address))
        .then(asserts.equal(result))
        .then(() => fakeCoin.balanceOf(sender))
        .then(asserts.equal(withdraw));
    });

    it('should withdraw even if not supported', () => {
      const sender = accounts[6];
      const value = 1000;
      const withdraw = 300;
      const result = 700;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.withdraw(withdraw, fakeCoin.address, {from: sender}))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, result))
        .then(assertExternalBalance(sender, fakeCoin.address, withdraw));
    });

  });


  describe("Internal transfer", () => {

    it('should check auth on internal transfer', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            sender,
            paymentGateway.address,
            paymentGateway.contract.transfer.getData().slice(0, 10)
          ), 0)
        )
        .then(() => paymentGateway.transfer(sender, receiver, value, fakeCoin.address, {from: sender}))
        .then(assertExpectations())
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should NOT perform internal transfer with empty _from address', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(
          '0x0', receiver, value, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(tx => error(tx, "Value is empty"))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should NOT perform internal transfer with unsupported contract', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.transfer(
          sender, receiver, value, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should THROW on internal transfer to many with empty _to address', () => {
      const sender = accounts[6];
      const receiver = '0x0';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transfer(
            sender, receiver, value, fakeCoin.address, {from: paymentProcessor}
          )
        ));
    });

    it("should THROW on internal transfer with null _value", () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 0;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transfer(
            sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}
          )
        ));
    });

    it('should THROW on internal transfer if not enough balance', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transfer(
            sender, receiver, value + 1, fakeCoin.address, {from: paymentProcessor}
          )
        ));
    });

    it('should THROW on internal transfer if overflow happened', () => {
      const sender = accounts[6];
      const receiver = accounts[7];
      const receiverBalance = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const value = 1;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.mint(receiver, receiverBalance))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.transferFrom(balanceHolder.address, '0x0', value))
        .then(() => paymentGateway.deposit(receiverBalance, fakeCoin.address, {from: receiver}))
        .then(() => asserts.throws(
          paymentGateway.transfer(
            sender, receiver, value, fakeCoin.address, {from: paymentProcessor}
          )
        ));
    });

    it('should NOT take fee on internal transfer if feePercent is 0', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 300;
      const result = 700;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(
          sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, transfer))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
    });

    it('should NOT take fee on internal transfer if feeAddress is not set', () => {
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 300;
      const result = 700;
      return Promise.resolve()
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(
          sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, transfer))
        .then(assertInternalBalance(sender, fakeCoin.address, result))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
    });

    it('should NOT take fee on internal transfer if transfer failed', () => {
      // Covered in `should not perform internal transfer *`
    });

    it('should THROW on internal transfer if taking fee failed (overflows)', () => {
      const feeAddress = accounts[7];
      const feeBalance = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 100;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.mint(feeAddress, feeBalance))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.transferFrom(balanceHolder.address, '0x0', value))
        .then(() => paymentGateway.deposit(feeBalance, fakeCoin.address, {from: feeAddress}))
        .then(() => asserts.throws(
          paymentGateway.transfer(
            sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}
          )
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, feeBalance, true))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, feeBalance, true))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
    });

    it('should perform internal transfer', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(
          sender, receiver, value, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, value))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should take fee on internal transfer', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 300;
      const result = 697;
      const fee = 3;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(
          sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, transfer))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
    });

    it('should take fee round up on internal transfer', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 301;
      const result = 695;
      const fee = 4;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(
          sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, transfer))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
    });

    it('should emit Transferred event in MultiEventsHistory on internal transfer', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 300;
      const result = 697;
      const fee = 3;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transfer(sender, receiver, transfer, fakeCoin.address, {from: paymentProcessor}))
        .then(result => {
          assert.equal(result.logs.length, 2);
          assert.equal(result.logs[0].address, multiEventsHistory.address);
          assert.equal(result.logs[0].event, 'Transferred');
          assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[0].args.from, sender);
          assert.equal(result.logs[0].args.to, receiver);
          assert.equal(result.logs[0].args.value.valueOf(), transfer);
          assert.equal(result.logs[1].address, multiEventsHistory.address);
          assert.equal(result.logs[1].event, 'Transferred');
          assert.equal(result.logs[1].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[1].args.from, sender);
          assert.equal(result.logs[1].args.to, feeAddress);
          assert.equal(result.logs[1].args.value.valueOf(), fee);
        });
    });

    it('should duplicate all of transfer to many cases...just in case?'); // TODO

  });


  describe('Internal transfer with fee', () => {

    it("should check auth on internal transfer with fee", () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => ignoreAuth(false))
        .then(() => mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            sender,
            paymentGateway.address,
            paymentGateway.contract.transferWithFee.getData().slice(0, 10)
          ), 0)
        )
        .then(() => paymentGateway.transferWithFee(
          sender, receiver, value, value, 0, fakeCoin.address, {from: sender}
        ))
        .then(assertExpectations())
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it("should NOT perform internal transfer with fee with null _from address", () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferWithFee(
          '0x0', receiver, value, value, 0, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(tx => error(tx, "Value is empty"))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it("should THROW on internal transfer with fee with null _to address", () => {
      const sender = accounts[6];
      const receiver = '0x0';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferWithFee(
            sender, receiver, value, value, 0, fakeCoin.address, {from: paymentProcessor}
          )
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it("should THROW on internal transfer with fee with null _value", () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 0;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferWithFee(
            sender, receiver, transfer, value, 0, fakeCoin.address, {from: paymentProcessor}
          )
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it("should NOT perform internal transfer with fee with unsupported contract", () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.transferWithFee(
          sender, receiver, value, value, 0, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it('should THROW on internal transfer with fee if not enough balance', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferWithFee(
            sender, receiver, value + 1, value, 0, fakeCoin.address, {from: paymentProcessor}
          )
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it('should THROW on internal transfer with fee if overflow happened', () => {
      const sender = accounts[6];
      const receiver = accounts[7];
      const receiverBalance = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const value = 1;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.mint(receiver, receiverBalance))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => fakeCoin.transferFrom(balanceHolder.address, '0x0', value))
        .then(() => paymentGateway.deposit(receiverBalance, fakeCoin.address, {from: receiver}))
        .then(() => asserts.throws(
          paymentGateway.transferWithFee(
            sender, receiver, value, value, 0, fakeCoin.address, {from: paymentProcessor}
          )
        ))
        .then(assertInternalBalance(receiver, fakeCoin.address, receiverBalance, true))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, receiverBalance, true))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it('should perform internal transfer with fee ' +
       'emitting Transferred event in MultiEventsHistory', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const value = 1000;
      const transfer = 300;
      const result = 697;
      const fee = 3;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferWithFee(
            sender, receiver, transfer, transfer, 0, fakeCoin.address, {from: paymentProcessor}
          )
        )
        .then(result => {
          assert.equal(result.logs.length, 2);
          assert.equal(result.logs[0].address, multiEventsHistory.address);
          assert.equal(result.logs[0].event, 'Transferred');
          assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[0].args.from, sender);
          assert.equal(result.logs[0].args.to, receiver);
          assert.equal(result.logs[0].args.value.valueOf(), transfer);
          assert.equal(result.logs[1].address, multiEventsHistory.address);
          assert.equal(result.logs[1].event, 'Transferred');
          assert.equal(result.logs[1].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[1].args.from, sender);
          assert.equal(result.logs[1].args.to, feeAddress);
          assert.equal(result.logs[1].args.value.valueOf(), fee);
        })
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertInternalBalance(receiver, fakeCoin.address, transfer))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0));
    });

    it('should duplicate all of transfer to many cases...just in case?'); // TODO

  });


  describe('Internal transfer to many', () => {

    it('should check auth on internal transfer to many', () => {
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 0;
      const receiver2Result = 0;
      const result = 1000;
      return Promise.resolve()
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => ignoreAuth(false))
      .then(() => {
        const expectedSig = helpers.getSig("transferToMany(address,address[],uint256[],uint256,uint256,address)");
        return mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            sender,
            paymentGateway.address,
            expectedSig
          ), 0)
        }
      )
      .then(() => paymentGateway.transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        0, 0, fakeCoin.address, {from: sender}
      ))
      .then(assertExpectations())
      .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
      .then(assertInternalBalance(sender, fakeCoin.address, result))

      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
      .then(assertExternalBalance(receiver1, fakeCoin.address, 0))
      .then(assertExternalBalance(receiver2, fakeCoin.address, 0))
      .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it('should NOT perform internal transfer to many with null _from address', () => {
      const sender = '0x0';
      const receiver1 = accounts[7];
      const receiver2 = accounts[8];
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 0;
      const receiver2Result = 0;
      const senderResult = 1000;
      const balanceHolderResult = 1000;
      return transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        receiver1Result, receiver2Result, senderResult,
        balanceHolderResult, false, error, ['Value is empty']
      );
    });

    it("should NOT perform internal transfer to many with unsupported contract", () => {
      const sender = accounts[6];
      const receiver1 = accounts[7];
      const receiver2 = accounts[8];
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 0;
      const receiver2Result = 0;
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.transferToMany(
            sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
            0, 0, fakeCoin.address, {from: paymentProcessor}
          )
        )
        .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
        .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
        .then(assertInternalBalance(sender, fakeCoin.address, value))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
        .then(assertExternalBalance(receiver1, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver2, fakeCoin.address, 0))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it('should THROW on internal transfer to many if _to and _value arrays have null length', () => {
      const sender = accounts[6];
      const value = 1000;
      const receiver1Result = 0;
      const receiver2Result = 0;
      return transferToMany(
        sender, [], [],
        receiver1Result, receiver2Result, value, value, true
      );
    });

    it('should NOT perform internal transfer to many if input arrays have different length', () => {
      const sender = accounts[6];
      const receiver1 = accounts[7];
      const receiver2 = accounts[8];
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 0;
      const receiver2Result = 0;
      const senderResult = 1000;
      const balanceHolderResult = 1000;
      return transferToMany(
        sender, [receiver1, receiver2, accounts[9]], [receiver1Value, receiver2Value],
        receiver1Result, receiver2Result, senderResult, balanceHolderResult,
        false, error, ["Invalid array arguments"]
      );
    });

    it('should THROW on internal transfer to many if one of the receivers is null address', () => {
      const sender = accounts[6];
      const receiver1 = '0x0';
      const receiver2 = accounts[8];
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 0;
      const receiver2Result = 0;
      const senderResult = 1000;
      const balanceHolderResult = 1000;
      return transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        receiver1Result, receiver2Result, senderResult, balanceHolderResult, true
      );
    });

    it('should THROW on internal transfer to many if one of the values is null', () => {
      const sender = accounts[6];
      const receiver1 = accounts[7];
      const receiver2 = accounts[8];
      const receiver1Value = 100;
      const receiver2Value = 0;
      const receiver1Result = 0;
      const receiver2Result = 0;
      const senderResult = 1000;
      const balanceHolderResult = 1000;
      return transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        receiver1Result, receiver2Result, senderResult, balanceHolderResult, true
      );
    });

    it('should THROW on internal transfer to many if not enough balance', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      return Promise.resolve()
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => asserts.throws(
        paymentGateway.transferToMany(
          sender, [receiver, receiver2], [value, 1],
          0, 0, fakeCoin.address, {from: paymentProcessor}
        )
      ));
    });

    it('should NOT take fee percent on internal transfer to many if feePercent is 0', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const result = 700;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        value, 0, fakeCoin.address, {from: paymentProcessor
      }))
      .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
      .then(assertInternalBalance(sender, fakeCoin.address, result))
      .then(assertInternalBalance(feeAddress, fakeCoin.address, 0))

      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
      .then(assertExternalBalance(receiver1, fakeCoin.address, 0))
      .then(assertExternalBalance(receiver2, fakeCoin.address, 0))
      .then(assertExternalBalance(sender, fakeCoin.address, 0))
      .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
    });

    it('should NOT take fee percent on internal transfer to many if feeAddress is not set', () => {
      const feePercent = 100;
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const result = 700;
      return Promise.resolve()
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(
          sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
          value, 0, fakeCoin.address, {from: paymentProcessor}
        )
      )
      .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
      .then(assertInternalBalance(sender, fakeCoin.address, result))

      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value))
      .then(assertExternalBalance(receiver1, fakeCoin.address, 0))
      .then(assertExternalBalance(receiver2, fakeCoin.address, 0))
      .then(assertExternalBalance(sender, fakeCoin.address, 0))
    });

    it('should THROW on internal transfer to many if cannot take fee percent', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 300;
      const receiverValue = 100;
      const receiver2Value = 200;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => asserts.throws(
        paymentGateway.transferToMany(
          sender, [receiver, receiver2], [receiverValue, receiver2Value],
          value, 0, fakeCoin.address, {from: paymentProcessor}
        )
      ));
    });

    it('should NOT take additional fee on internal transfer to many if feeAddress is not set', () => {
      const additionalFee = 100;
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const result = 700;
      return Promise.resolve()
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        0, additionalFee, fakeCoin.address, {from: paymentProcessor}
      ))
      .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
      .then(assertInternalBalance(sender, fakeCoin.address, result))
      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should THROW on internal transfer to many if cannot take additional fee', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const additionalFee = 1;
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 300;
      const receiver1Value = 100;
      const receiver2Value = 200;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => asserts.throws(
        paymentGateway.transferToMany(
          sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
          0, additionalFee, fakeCoin.address, {from: paymentProcessor}
        )
      ));
    });

    it('should perform internal transfer to many', () => {
      const sender = accounts[6];
      const receiver1 = accounts[7];
      const receiver2 = accounts[8];
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const senderResult = 700;
      const balanceHolderResult = 1000;
      return transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        receiver1Result, receiver2Result, senderResult, balanceHolderResult, false
      );
    });

    it('should take fee percent on internal transfer to many', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiverValue = 100;
      const receiver2Value = 200;
      const receiverResult = 100;
      const receiver2Result = 200;
      const fee = 10;
      const result = 690;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(sender, [receiver, receiver2], [receiverValue, receiver2Value], value, 0, fakeCoin.address, {from: paymentProcessor}))
      .then(assertInternalBalance(receiver, fakeCoin.address, receiverValue))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Value))
      .then(assertInternalBalance(sender, fakeCoin.address, result))
      .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))
      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should take fee percent from specified value on internal transfer to many', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 100;
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const feeFrom = 100;
      const receiverValue = 100;
      const receiver2Value = 200;
      const receiverResult = 100;
      const receiver2Result = 200;
      const fee = 1;
      const result = 699;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(sender, [receiver, receiver2], [receiverValue, receiver2Value], feeFrom, 0, fakeCoin.address, {from: paymentProcessor}))
      .then(assertInternalBalance(receiver, fakeCoin.address, receiverValue))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Value))
      .then(assertInternalBalance(sender, fakeCoin.address, result))
      .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))
      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should emit Transferred events in MultiEventsHistory on internal transfer to many', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 200;
      const additionalFee = 100;
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const result = 580;
      const fee = 120;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        value, additionalFee, fakeCoin.address, {from: paymentProcessor}
      ))
      .then(result => {
        assert.equal(result.logs.length, 3);
        assert.equal(result.logs[0].address, multiEventsHistory.address);
        assert.equal(result.logs[0].event, 'Transferred');
        assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
        assert.equal(result.logs[0].args.from, sender);
        assert.equal(result.logs[0].args.to, receiver1);
        assert.equal(result.logs[0].args.value.valueOf(), receiver1Result);

        assert.equal(result.logs[1].address, multiEventsHistory.address);
        assert.equal(result.logs[1].event, 'Transferred');
        assert.equal(result.logs[1].args.contractAddress, fakeCoin.address);
        assert.equal(result.logs[1].args.from, sender);
        assert.equal(result.logs[1].args.to, receiver2);
        assert.equal(result.logs[1].args.value.valueOf(), receiver2Result);

        assert.equal(result.logs[2].address, multiEventsHistory.address);
        assert.equal(result.logs[2].event, 'Transferred');
        assert.equal(result.logs[2].args.contractAddress, fakeCoin.address);
        assert.equal(result.logs[2].args.from, sender);
        assert.equal(result.logs[2].args.to, feeAddress);
        assert.equal(result.logs[2].args.value.valueOf(), fee);
      })
      .then(assertInternalBalance(sender, fakeCoin.address, result));
    });

    it('should take additional fee on internal transfer to many', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const additionalFee = 100;
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const result = 600;
      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => fakeCoin.mint(sender, value))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferToMany(
          sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
          0, additionalFee, fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
        .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, additionalFee))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should take additional fee and fee percent on internal transfer to many', () => {
      const feeAddress = '0x00ffffffffffffffffffffffffffffffffffffff';
      const feePercent = 200;
      const additionalFee = 100;
      const sender = accounts[6];
      const receiver1 = '0xffffffffffffffffffffffffffffffffffffff00';
      const receiver2 = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const receiver1Value = 100;
      const receiver2Value = 200;
      const receiver1Result = 100;
      const receiver2Result = 200;
      const result = 580;
      const fee = 120;
      return Promise.resolve()
      .then(() => paymentGateway.setFeeAddress(feeAddress))
      .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
      .then(() => fakeCoin.mint(sender, value))
      .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
      .then(() => paymentGateway.transferToMany(
        sender, [receiver1, receiver2], [receiver1Value, receiver2Value],
        value, additionalFee, fakeCoin.address, {from: paymentProcessor}
      ))
      .then(assertInternalBalance(receiver1, fakeCoin.address, receiver1Result))
      .then(assertInternalBalance(receiver2, fakeCoin.address, receiver2Result))
      .then(assertInternalBalance(sender, fakeCoin.address, result))
      .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))
      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

  });


  describe('Transfer all', () => {

    it('should should check auth on `transferAll`', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 1000;

      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => {
          const expectedSig = helpers.getSig("transferAll(address,address,uint256,address,uint256,uint256,address)");
          return mock.expect(
            paymentGateway.address,
            0,
            roles2LibraryInterface.canCall.getData(
              sender,
              paymentGateway.address,
              expectedSig
            ), 0)
          }
        )
        .then(() => ignoreAuth(false))
        .then(() => paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, 0, fakeCoin.address, {from: sender}
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0))
    });

    it('should NOT perform `transferAll` if _from address is null', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 1000;

      const fakeSender = '0x0';
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferAll(
          fakeSender, receiver, value, changeAddress, value, 0, fakeCoin.address
        ))
        .then(tx => error(tx, "Value is empty"))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    });

    it('should NOT perform `transferAll` if contract is not supported', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 1000;

      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, 0, fakeCoin.address
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    });

    it('should THROW on `transferAll` if _to address is null', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 1000;

      const fakeReceiver = '0x0';
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferAll(
            sender, fakeReceiver, value, changeAddress, value, 0, fakeCoin.address
          )
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(fakeReceiver, fakeCoin.address, 0))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(fakeReceiver, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    });

    it('should THROW on `transferAll` if _value is null', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 0;

      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferAll(
            sender, receiver, value, changeAddress, value, 0, fakeCoin.address
          )
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    });

    it('should THROW on `transferAll` if there is a change left but change address is null', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0x0';
      const balance = 5000;
      const value = 1000;

      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferAll(
            sender, receiver, value, changeAddress, value, 0, fakeCoin.address
          )
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    })

    it('should THROW on `transferAll` if sender has insufficient balance', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 1000;
      const value = 1001;

      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, 0, fakeCoin.address
        )))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    });

    it('should THROW on `transferAll` if cannot take fee percent', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const feeAddress = '0xffffffffffffffffffffffffffffffffffffff02';
      const balance = 1100;
      const value = 1000;
      const feePercent = 1100;  // 11% => 110 tokens

      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferAll(
            sender, receiver, value, changeAddress, value, 0, fakeCoin.address
          )
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0));
    });

    it('should THROW on `transferAll` if cannot take additional fee', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const feeAddress = '0xffffffffffffffffffffffffffffffffffffff02';
      const balance = 1100;
      const value = 1000;
      const additionalFee = 101;

      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => asserts.throws(
          paymentGateway.transferAll(
            sender, receiver, value, changeAddress, value, additionalFee, fakeCoin.address
          )
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, balance))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, 0))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0));
    });

    it('should NOT take fee on `transferAll` if fee is set but fee address is not set', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 1000;
      const feePercent = 1000;  // 10%
      const change = balance - value;

      return Promise.resolve()
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, 0, fakeCoin.address
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertInternalBalance(receiver, fakeCoin.address, value))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, change))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, balance))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
        .then(assertExternalBalance(changeAddress, fakeCoin.address, 0));
    });

    it('should distribute correct amount of tokens on `transferAll`', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const balance = 5000;
      const value = 1000;
      const change = balance - value;

      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, 0, fakeCoin.address
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertInternalBalance(receiver, fakeCoin.address, value))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, change));
    });

    it('should distribute correct amount of tokens on `transferAll` with fee percent', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const feeAddress = '0xffffffffffffffffffffffffffffffffffffff02';
      const balance = 5000;
      const value = 1000;
      const feePercent = 1000;  // 10%
      const fee = value * feePercent / 10000;
      const change = balance - value - fee;

      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, 0, fakeCoin.address
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertInternalBalance(receiver, fakeCoin.address, value))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, fee))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, change));
    });

    it('should distribute correct amount of tokens on' +
      '`transferAll` with fee percent and additional fee', () => {
      const sender = accounts[6];
      const receiver = '0xffffffffffffffffffffffffffffffffffffff00';
      const changeAddress = '0xffffffffffffffffffffffffffffffffffffff01';
      const feeAddress = '0xffffffffffffffffffffffffffffffffffffff02';
      const balance = 5000;
      const value = 1000;
      const feePercent = 1000;  // 10%
      const additionalFee = 200;
      const fee = value * feePercent / 10000;
      const change = balance - value - fee - additionalFee;

      return Promise.resolve()
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.setFeePercent(feePercent, fakeCoin.address))
        .then(() => fakeCoin.mint(sender, balance))
        .then(() => paymentGateway.deposit(balance, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.transferAll(
          sender, receiver, value, changeAddress, value, additionalFee, fakeCoin.address
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, 0))
        .then(assertInternalBalance(receiver, fakeCoin.address, value))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, fee + additionalFee))
        .then(assertInternalBalance(changeAddress, fakeCoin.address, change));
    });

  });


  describe('Internal transfer from many', () => {

    it('should check auth on internal transfer from many', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7]
      const receiver = accounts[8];
      const value1 = 1000;
      const value2 = 200;
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;
      return Promise.resolve()
      .then(() => fakeCoin.mint(sender1, value1))
      .then(() => fakeCoin.mint(sender2, value2))
      .then(() => paymentGateway.deposit(value1, fakeCoin.address, {from: sender1}))
      .then(() => paymentGateway.deposit(value2, fakeCoin.address, {from: sender2}))
      .then(() => ignoreAuth(false))
      .then(() => {
        const expectedSig = helpers.getSig("transferFromMany(address[],address,uint256[],address)");
        return mock.expect(
          paymentGateway.address,
          0,
          roles2LibraryInterface.canCall.getData(
            sender1,
            paymentGateway.address,
            expectedSig
          ), 0)
      })
      .then(() => paymentGateway.transferFromMany(
        [sender1, sender2], receiver, [value1, value2], fakeCoin.address, {from: sender1}))
      .then(assertExpectations())
      .then(assertInternalBalance(sender1, fakeCoin.address, sender1Result))
      .then(assertInternalBalance(sender2, fakeCoin.address, sender2Result))
      .then(assertInternalBalance(receiver, fakeCoin.address, result))

      .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value1 + value2))
      .then(assertExternalBalance(sender1, fakeCoin.address, 0))
      .then(assertExternalBalance(sender2, fakeCoin.address, 0))
      .then(assertExternalBalance(receiver, fakeCoin.address, 0));
    });

    it('should NOT perform internal transfer from many with null _to address', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7]
      const receiver = '0x0';
      const value1 = 1000;
      const value2 = 200;
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;
      return transferFromMany(
        [sender1, sender2], receiver, [value1, value2], sender1Result,
        sender2Result, result, value1 + value2, false, error, "Value is empty"
      );
    });

    it('should NOT perform internal transfer from many with unsupported ERC20 contract', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7];
      const receiver = accounts[8];
      const value1 = 1000;
      const value2 = 200;
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;
      return transferFromMany(
        [sender1, sender2], receiver, [value1, value2], sender1Result,
        sender2Result, result, value1 + value2, false, undefined, null,
        erc20Library.removeContract, [fakeCoin.address]
      );
    });

    it('should THROW on internal transfer from many with empty _from and _value arrays', () => {
      const receiver = accounts[8];
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;
      return transferFromMany(
        [], receiver, [], sender1Result,
        sender2Result, result, sender1Result+sender2Result, true
      );
    });

    it('should NOT perform internal transfer from many if arrays length is different', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7];
      const receiver = accounts[8];
      const value1 = 1000;
      const value2 = 200;
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;
      return transferFromMany(
        [sender1, sender2, accounts[9]], receiver, [value1, value2], sender1Result,
        sender2Result, result, value1 + value2, false, error, "Invalid array arguments"
      );
    });

    it('should THROW on internal transfer from many if one of the _from addresses is null', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7];
      const receiver = accounts[8];
      const value1 = 1000;
      const value2 = 200;
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;

      const fakeSender = '0x0';
      return transferFromMany(
        [sender1, fakeSender], receiver, [value1, value2], sender1Result,
        sender2Result, result, value1 + value2, true
      );
    });

    it('should THROW on internal transfer from many if one of the _value values is null', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7];
      const receiver = accounts[8];
      const value1 = 1000;
      const value2 = 200;
      const sender1Result = 1000;
      const sender2Result = 200;
      const result = 0;

      const fakeValue = 0;
      return transferFromMany(
        [sender1, sender2], receiver, [value1, fakeValue], sender1Result,
        sender2Result, result, value1 + value2, true
      );
    });

    it('should THROW on internal transfer from many if not enough balance', () => {
      const sender1 = accounts[6];
      const sender2 = accounts[7];
      const receiver = '0xffffffffffffffffffffffffffffffffffff0000';
      const value1 = 1000;
      const value2 = 100;
      const sender1Value = 1100;
      const sender2Value = 70;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender1, value1))
        .then(() => fakeCoin.mint(sender2, value2))
        .then(() => paymentGateway.deposit(value1, fakeCoin.address, {from: sender1}))
        .then(() => paymentGateway.deposit(value2, fakeCoin.address, {from: sender2}))
        .then(() => asserts.throws(
          paymentGateway.transferFromMany(
            [sender1, sender2], receiver, [sender1Value, sender2Value],
            fakeCoin.address, {from: paymentProcessor}
          )
        ))
        .then(assertInternalBalance(sender1, fakeCoin.address, value1))
        .then(assertInternalBalance(sender2, fakeCoin.address, value2))
        .then(assertInternalBalance(receiver, fakeCoin.address, 0))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value1 + value2))
        .then(assertExternalBalance(sender1, fakeCoin.address, 0))
        .then(assertExternalBalance(sender2, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0));
    });

    it('should perform internal transfer from many', () => {
      const sender = accounts[6];
      const sender2 = accounts[7];
      const receiver = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const value2 = 100;
      const totalValue = 1100;
      const senderValue = 200;
      const sender2Value = 70;
      const receiverResult = 270;
      const result = 800;
      const result2 = 30;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.mint(sender2, value2))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.deposit(value2, fakeCoin.address, {from: sender2}))
        .then(() => paymentGateway.transferFromMany(
          [sender, sender2], receiver, [senderValue, sender2Value],
          fakeCoin.address, {from: paymentProcessor}
        ))
        .then(assertInternalBalance(sender, fakeCoin.address, result))
        .then(assertInternalBalance(sender2, fakeCoin.address, result2))
        .then(assertInternalBalance(receiver, fakeCoin.address, receiverResult))

        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, totalValue))
        .then(assertExternalBalance(sender, fakeCoin.address, 0))
        .then(assertExternalBalance(sender2, fakeCoin.address, 0))
        .then(assertExternalBalance(receiver, fakeCoin.address, 0))
    });

    it('should emit Transferred events in MultiEventsHistory on internal transfer from many', () => {
      const sender = accounts[6];
      const sender2 = accounts[7];
      const receiver = '0xffffffffffffffffffffffffffffffffffff0000';
      const value = 1000;
      const value2 = 100;
      const totalValue = 1100;
      const senderValue = 200;
      const sender2Value = 70;
      const receiverResult = 270;
      const result = 800;
      const result2 = 30;
      return Promise.resolve()
        .then(() => fakeCoin.mint(sender, value))
        .then(() => fakeCoin.mint(sender2, value2))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: sender}))
        .then(() => paymentGateway.deposit(value2, fakeCoin.address, {from: sender2}))
        .then(() => paymentGateway.transferFromMany([sender, sender2], receiver, [senderValue, sender2Value], fakeCoin.address, {from: paymentProcessor}))
        .then(result => {
          assert.equal(result.logs.length, 2);
          assert.equal(result.logs[0].address, multiEventsHistory.address);
          assert.equal(result.logs[0].event, 'Transferred');
          assert.equal(result.logs[0].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[0].args.from, sender);
          assert.equal(result.logs[0].args.to, receiver);
          assert.equal(result.logs[0].args.value.valueOf(), senderValue);

          assert.equal(result.logs[1].address, multiEventsHistory.address);
          assert.equal(result.logs[1].event, 'Transferred');
          assert.equal(result.logs[1].args.contractAddress, fakeCoin.address);
          assert.equal(result.logs[1].args.from, sender2);
          assert.equal(result.logs[1].args.to, receiver);
          assert.equal(result.logs[1].args.value.valueOf(), sender2Value);
        });
    });

  });


  describe('Fees', () => {

    it('should NOT forward null fee value', () => {
      const feeAddress = accounts[6];
      const value = 1000;
      const fakeValue = 0;
      return Promise.resolve()
        .then(() => fakeCoin.mint(feeAddress, value))
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: feeAddress}))
        .then(() => paymentGateway.forwardFee(fakeValue, fakeCoin.address))
        .then(tx => error(tx, "Value is empty"))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, value))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should NOT forward collected fee if feeAddress is not set', () => {
      const feeAddress = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(feeAddress, value))
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: feeAddress}))
        .then(() => paymentGateway.setFeeAddress('0x0'))
        .then(() => paymentGateway.forwardFee(value, fakeCoin.address))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, value))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, 0))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, value));
    });

    it('should THROW on forward fee when underflow happens', () => {
      /**
       * Covered in withdrawal
       */
    });

    it('should NOT forward if error occurred in ERC20 contract', () => {
      /**
       * Covered in withdrawal
       */
    });

    it('should NOT forward more fee than available', () => {
      /**
       * Covered in withdrawal
       */
    });

    it('should forward collected fee, emitting "Withdrawn" event', () => {
      const feeAddress = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(feeAddress, value))
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: feeAddress}))
        .then(() => paymentGateway.forwardFee(value, fakeCoin.address))
        .then(helpers.assertLogs(1, [{
            address: multiEventsHistory.address,
            event: "Withdrawn",
            args: {
              self: paymentGateway.address,
              contractAddress: fakeCoin.address,
              by: feeAddress,
              value: value
            }
          }]
        ))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0));
    });

    it('should forward fee for unsupported contract', () => {
      const feeAddress = accounts[6];
      const value = 1000;
      return Promise.resolve()
        .then(() => fakeCoin.mint(feeAddress, value))
        .then(() => paymentGateway.setFeeAddress(feeAddress))
        .then(() => paymentGateway.deposit(value, fakeCoin.address, {from: feeAddress}))
        .then(() => erc20Library.removeContract(fakeCoin.address))
        .then(() => paymentGateway.forwardFee(value, fakeCoin.address))
        .then(assertInternalBalance(feeAddress, fakeCoin.address, 0))
        .then(assertExternalBalance(feeAddress, fakeCoin.address, value))
        .then(assertExternalBalance(balanceHolder.address, fakeCoin.address, 0));
    });

  });

});
