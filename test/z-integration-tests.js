const BoardController = artifacts.require('BoardController')
const BalanceHolder = artifacts.require('./BalanceHolder.sol');
const ERC20Library = artifacts.require('./ERC20Library.sol');
const FakeCoin = artifacts.require('./FakeCoin.sol');
const JobController = artifacts.require('./JobController.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const PaymentProcessor = artifacts.require('./PaymentProcessor.sol');
const Roles2LibraryInterface = artifacts.require('./Roles2LibraryInterface.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const UserLibrary = artifacts.require('./UserLibrary.sol');
const RatingsAndReputationLibrary = artifacts.require('./RatingsAndReputationLibrary.sol');


const Asserts = require('./helpers/asserts')
const Reverter = require('./helpers/reverter')
const eventsHelper = require('./helpers/eventsHelper')
const helpers = require('./helpers/helpers')
const Promise = require('bluebird')

contract('Integration tests (user stories)', (accounts) => {

    const reverter = new Reverter(web3);

    const stages = {
        NOT_SET: 0,
        CREATED: 1,
        ACCEPTED: 2,
        PENDING_START: 3,
        STARTED: 4,
        PENDING_FINISH: 5,
        FINISHED: 6,
        FINALIZED: 7
    };

    const roles = {
        moderator: 77
    }
    const users = {
        default: accounts[0],
        contractOwner: accounts[0],
        root: accounts[5],
        moderator: accounts[4],
        client: accounts[2],
        worker: accounts[7],
        worker2: accounts[8],
        recovery: "0xffffffffffffffffffffffffffffffffffffffff",
    }
    var contracts = {}

    var board = {
        id: null,
        name: 'My and your jobs',
        description: 'Board desription from the bottom of a heart',
        tags: 1,
        tagsArea: 1,
        tagsCategory: 1
    }

    var jobs = [
        {
            id: null,
            area: 4,
            category: 4,
            skills: 4,
            details: '0x00bb00bb00bb00bb00bb'
        },
        {
            id: null,
            area: 4,
            category: 4,
            skills: 8,
            details: '0x00aa00aa00aa00aa00aa'
        },
        {
            id: null,
            area: 4,
            category: 4,
            skills: 4,
            details: '0x00ee00ee00ee00ee00ee'
        },
    ]

    const setupJob = async (_job, _client = users.client, _depositBalance = 1000000000) => {
        const roles = []

        await contracts.coin.mint(_client, _depositBalance)
        await contracts.paymentGateway.deposit(_depositBalance, contracts.coin.address, { from: _client })

        const postJobTx = await contracts.jobController.postJob(_job.area, _job.category, _job.skills, _job.details, { from: _client })
        const postJobEvent = (await eventsHelper.findEvent([contracts.jobController], postJobTx, "JobPosted"))[0]

        let jobId = postJobEvent.args.jobId
        assert.isNotNull(jobId)

        return jobId
    }

    const setupBoard = async (_board) => {
        const boardTx = await contracts.boardController.createBoard(board.name, board.description, board.tags, board.tagsArea, board.tagsCategory, { from: users.moderator })
        const boardEmitter = contracts.boardController
        const createBoardEvent = (await eventsHelper.findEvent([boardEmitter], boardTx, 'BoardCreated'))[0]
        assert.isDefined(createBoardEvent)

        const boardId = createBoardEvent.args.boardId
        assert.isNotNull(boardId)

        return boardId
    }

    const bindJobWithBoard = async (_boardId, _jobId) => {
        await contracts.boardController.bindJobWithBoard(_boardId, _jobId)
        let jobsBoardId = await contracts.boardController.getJobsBoard.call(_jobId)
        assert.notEqual(jobsBoardId, 0)
        assert.equal(jobsBoardId, _jobId)
    }

    const setupWorker = async (_job, _worker = users.worker) => {
        const roles = []
        await contracts.userLibrary.setMany(_worker, _job.area, [_job.category], [_job.skills], { from: users.root })
        return _worker
    }

    const bindWorkerWithBoard = async (_user, _boardId) => {
        await contracts.boardController.bindUserWithBoard(_boardId, _user)
        let status = await contracts.boardController.getUserStatus.call(_boardId, _user)
        assert.isTrue(status)
    }


    before('setup', async () => {
        contracts.boardController = await BoardController.deployed()
        contracts.rolesLibrary = await Roles2Library.deployed()
        contracts.userLibrary = await UserLibrary.deployed()
        contracts.ratingLibrary = await RatingsAndReputationLibrary.deployed()
        contracts.jobController = await JobController.deployed()
        contracts.coin = await FakeCoin.deployed()
        contracts.erc20Manager = await ERC20Library.deployed()
        contracts.paymentGateway = await PaymentGateway.deployed()

        await contracts.ratingLibrary.setBoardController(contracts.boardController.address, { from: users.default })
        await contracts.ratingLibrary.setJobController(contracts.jobController.address, { from: users.default })
        await contracts.ratingLibrary.setUserLibrary(contracts.userLibrary.address, { from: users.default })

        await contracts.erc20Manager.addContract(contracts.coin.address, { from: users.default })

        await contracts.rolesLibrary.setRootUser(users.root, true, { from: users.contractOwner })
        await contracts.rolesLibrary.setRootUser(users.default, false, { from: users.contractOwner })

        const createBoardData = contracts.boardController.contract.createBoard.getData(0,0,0,0,0).slice(0,10)
        const closeBoardData = contracts.boardController.contract.closeBoard.getData(0).slice(0,10)
        await contracts.rolesLibrary.addRoleCapability(roles.moderator, contracts.boardController.address, createBoardData, { from: users.contractOwner })
        await contracts.rolesLibrary.addRoleCapability(roles.moderator, contracts.boardController.address, closeBoardData, { from: users.contractOwner })
        await contracts.rolesLibrary.addUserRole(users.moderator, roles.moderator, { from: users.root })

        await reverter.snapshot()
    })

    beforeEach('setup board and jobs', async () => {
        board.id = await setupBoard(board)

        await Promise.each(jobs, async (job, idx) => {
            let jobId = await setupJob(job)
            jobs[idx].id = jobId

            await bindJobWithBoard(jobId, board.id)
        })

    })

    afterEach('revert', async () => {
        board.id = null
        jobs.forEach((e,idx) => jobs[idx].id = null)

        await reverter.revert()
    })

    context('as a client', () => {

        it('I want to post a job and wait for offers, then I will choose one from a list of workers and accept one of them; couldn\'t cancel an accepted offer', async () => {
            const job = jobs[0]

            let workers = [users.worker, users.worker2]

            await Promise.each(workers, async (_worker) => await setupWorker(job, _worker))

            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 100, 100, 100, { from: users.worker })
            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 90, 110, 80, { from: users.worker2 })

            var jobState = await contracts.jobController.getJobState.call(job.id)
            assert.equal(jobState, stages.CREATED)

            const acceptWorkerTx = await contracts.jobController.acceptOffer(job.id, users.worker2, { from: users.client })
            const acceptWorkerEvent = (await eventsHelper.findEvent([contracts.jobController], acceptWorkerTx, "JobOfferAccepted"))[0]
            assert.isDefined(acceptWorkerEvent)

            try {
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
                assert.isTrue(false)
            } catch (e) {
                assert.isTrue(true)
            }
        })

        it('I want to delete a posted job')

        it('I want to cancel a job if I have some doubts or reasons, worker should receive his payment according to time he spent working', async () => {
            const job = jobs[0]
            await setupWorker(job, users.worker)

            let initialWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)

            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 100, 100, 100, { from: users.worker })
            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })
            await helpers.increaseTime(4*60*60) // 4 hours
            await contracts.jobController.cancelJob(job.id, { from: users.client })
            await contracts.jobController.releasePayment(job.id, { from: users.default })

            var jobState = await contracts.jobController.getJobState.call(job.id)
            assert.equal(jobState, stages.FINALIZED)

            let afterPaymentWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)

            assert.notEqual(initialWorkerBalance, afterPaymentWorkerBalance)
        })

        it('I want to post a job and pay for it with some non-standart tokens (ERC20 tokens)', async () => {
            const depositBalance = 10000000000

            let erc20NonStandartToken = await FakeCoin.new()
            await contracts.erc20Manager.addContract(erc20NonStandartToken.address, { from: users.root })

            await erc20NonStandartToken.mint(users.client, depositBalance)
            await contracts.paymentGateway.deposit(depositBalance, erc20NonStandartToken.address, { from: users.client })

            const job = jobs[0]
            await setupWorker(job, users.worker)

            let initialWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, erc20NonStandartToken.address)

            let postJobOfferTx = await contracts.jobController.postJobOffer(job.id, erc20NonStandartToken.address, 200, 200, 100, { from: users.worker })
            let postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], postJobOfferTx, 'JobOfferPosted'))[0]
            assert.isDefined(postJobOfferEvent)

            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })

            await helpers.increaseTime(20*(8*60*60)) // 20 working days

            await contracts.jobController.endWork(job.id, { from: users.worker })
            await contracts.jobController.confirmEndWork(job.id, { from: users.client })

            await contracts.jobController.releasePayment(job.id, { from: users.default })

            let afterPaymentWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, erc20NonStandartToken.address)
            assert.notEqual(initialWorkerBalance, afterPaymentWorkerBalance)
        })

        it('I want to be able to extend work time by increasing estimated time for some value if a worker need more time to finish his work', async () => {
            const job = jobs[0]
            await setupWorker(job, users.worker)

            // without extend

            let initialWorkerBalance = await contracts.coin.balanceOf.call(users.worker)
            assert.equal(initialWorkerBalance, 0)

            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 100, 100, 100, { from: users.worker })
            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })
            await helpers.increaseTime(4*60*60) // 4 hours
            await contracts.jobController.endWork(job.id, { from: users.worker })
            await contracts.jobController.confirmEndWork(job.id, { from: users.client })

            await contracts.jobController.releasePayment(job.id, { from: users.default })

            let afterPaymentWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)


            // with extend

            const otherJob = jobs[2]
            await setupWorker(otherJob, users.worker2)

            let initialWorker2Balance = await contracts.coin.balanceOf.call(users.worker2)
            assert.equal(initialWorker2Balance, 0)

            await contracts.jobController.postJobOffer(otherJob.id, contracts.coin.address, 100, 100, 100, { from: users.worker2 })
            await contracts.jobController.acceptOffer(otherJob.id, users.worker2, { from: users.client })
            await contracts.jobController.startWork(otherJob.id, { from: users.worker2 })
            await contracts.jobController.confirmStartWork(otherJob.id, { from: users.client })
            await helpers.increaseTime(1*60*60) // 1 hour
            await contracts.jobController.addMoreTime(otherJob.id, 150, { from: users.client})
            await helpers.increaseTime(3*60*60) // 3 hours
            await contracts.jobController.endWork(otherJob.id, { from: users.worker2 })
            await contracts.jobController.confirmEndWork(otherJob.id, { from: users.client })

            await contracts.jobController.releasePayment(otherJob.id, { from: users.default })
            let afterPaymentWorker2Balance = await contracts.paymentGateway.getBalance.call(users.worker2, contracts.coin.address)

            // a worker after adding more time receives bigger payment and working the same amount of time
            assert.isAbove(afterPaymentWorker2Balance.valueOf(), afterPaymentWorkerBalance.valueOf())
        })

        it('I want to give feedback on worker\'s labor by setting a rating after work is done', async () => {
            const job = jobs[0]
            await setupWorker(job, users.worker)
            await bindWorkerWithBoard(users.worker, board.id)

            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 100, 100, 100, { from: users.worker })
            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })
            await helpers.increaseTime(2*60*60) // 2 hours
            await contracts.jobController.endWork(job.id, { from: users.worker })
            await contracts.jobController.confirmEndWork(job.id, { from: users.client })

            await contracts.jobController.releasePayment(job.id, { from: users.default })

            let expectedWorkerRating = {}
            expectedWorkerRating[users.worker] = 9
            await contracts.ratingLibrary.setUserRating(users.worker, expectedWorkerRating[users.worker], { from: users.client })
            let actualWorkerRating = await contracts.ratingLibrary.getUserRating.call(users.client, users.worker)
            assert.equal(actualWorkerRating, expectedWorkerRating[users.worker])

            var skillRatings = {}
            skillRatings[job.skills] = 8
            await contracts.ratingLibrary.rateWorkerSkills(job.id, users.worker, job.area, job.category, [job.skills], [skillRatings[job.skills]], { from: users.client })
            let [_client, skillRating] = await contracts.ratingLibrary.getSkillRating.call(users.worker, job.area, job.category, job.skills, job.id)
            assert.equal(_client, users.client)
            assert.equal(skillRatings[job.skills], skillRating)

        })
    })

    context('as a worker', async () => {

        it('I want to look into board, find a job with my skills and make an offer for it', async () => {
            const workerExpertise = jobs[0]
            await setupWorker(workerExpertise, users.worker)

            let jobsCount = await contracts.jobController.getJobsCount.call()
            let jobsIds = [...Array.apply(null, { length: jobsCount }).keys()].map(id => id + 1);
            var appropriateJobIds = []
            await Promise.each(jobsIds, async (jobId) => {
                let jobSkillsArea = await contracts.jobController.getJobSkillsArea.call(jobId)
                let jobSkillsCategory = await contracts.jobController.getJobSkillsCategory.call(jobId)
                let jobSkills = await contracts.jobController.getJobSkills.call(jobId)
                let jobState = await contracts.jobController.getJobState.call(jobId)

                if (jobState != stages.CREATED) {
                    return;
                }

                if (jobSkillsArea != workerExpertise.area ||
                     jobSkillsCategory != workerExpertise.category ||
                     jobSkills != workerExpertise.skills) {
                    return;
                }

                appropriateJobIds.push(jobId)
            })

            assert.notEqual(appropriateJobIds.length, 0)

            let gotJobId = appropriateJobIds[Math.floor(Math.random()*appropriateJobIds.length)];

            let postJobOfferTx = await contracts.jobController.postJobOffer(gotJobId, contracts.coin.address, 200, 200, 100, { from: users.worker })
            let postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], postJobOfferTx, 'JobOfferPosted'))[0]
            assert.isDefined(postJobOfferEvent)
        })

        it('I want to be able to have a reward after I will be done with my work and client will be fulfilled', async () => {
            const job = jobs[0]
            await setupWorker(job, users.worker)

            let initialWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)

            let postJobOfferTx = await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 200, 200, 100, { from: users.worker })
            let postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], postJobOfferTx, 'JobOfferPosted'))[0]
            assert.isDefined(postJobOfferEvent)

            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })

            await helpers.increaseTime(20*(8*60*60)) // 20 working days

            await contracts.jobController.endWork(job.id, { from: users.worker })
            await contracts.jobController.confirmEndWork(job.id, { from: users.client })
            await contracts.jobController.releasePayment(job.id, { from: users.default })

            let afterPaymentWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)
            assert.notEqual(initialWorkerBalance, afterPaymentWorkerBalance)
        })

        it('I want to make offers for different jobs if they are in different time periods', async () => {
            const workerExpertise = jobs[0]
            await setupWorker(workerExpertise, users.worker)

            let jobsCount = await contracts.jobController.getJobsCount.call()
            let jobsIds = [...Array.apply(null, { length: jobsCount }).keys()].map(id => id + 1);
            // console.log('empty', Array(jobsCount));
            var appropriateJobIds = []
            await Promise.each(jobsIds, async (jobId) => {
                let jobSkillsArea = await contracts.jobController.getJobSkillsArea.call(jobId)
                let jobSkillsCategory = await contracts.jobController.getJobSkillsCategory.call(jobId)
                let jobSkills = await contracts.jobController.getJobSkills.call(jobId)
                let jobState = await contracts.jobController.getJobState.call(jobId)

                if (jobState != stages.CREATED) {
                    return;
                }

                if (jobSkillsArea != workerExpertise.area ||
                     jobSkillsCategory != workerExpertise.category ||
                     jobSkills != workerExpertise.skills) {
                    return;
                }

                appropriateJobIds.push(jobId)
            })

            assert.isAtLeast(appropriateJobIds.length, 2)

            await Promise.each(appropriateJobIds, async (jobId) => {
                let postJobOfferTx = await contracts.jobController.postJobOffer(jobId, contracts.coin.address, 200, 200, 100, { from: users.worker })
                let postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], postJobOfferTx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })
        })

        it('I want to participate in job\'s trades and apply a competitive offer (several times by increasing or decreasing value)', async () => {
            const workerExpertise = jobs[0]
            await setupWorker(workerExpertise, users.worker)
            await setupWorker(workerExpertise, users.worker2)

            const job = jobs[0]

            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 100, 100, 100, { from: users.worker })
            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 95, 100, 90, { from: users.worker2 })
            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 90, 100, 90, { from: users.worker })
            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 80, 95, 85, { from: users.worker2 })
            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 90, 80, 80, { from: users.worker })

            let notExpectedPreviousLockedAmount = ((90 * (60 + 100) + 90) / 10) * 11
            let expectedLastLockedAmount = ((90 * (60 + 80) + 80) / 10) * 11

            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })

            let actualLockedAmount = await contracts.jobController.calculateLockAmount(job.id)
            assert.isBelow(expectedLastLockedAmount, notExpectedPreviousLockedAmount)
            assert.equal(actualLockedAmount, expectedLastLockedAmount)

            try {
                await contracts.jobController.acceptOffer(job.id, users.worker2, { from: users.client })
                assert.isTrue(false)
            } catch (e) {
                assert.isTrue(true)
            }
        })

        it('I want to create a profile and participate in job offers')

        it('I want that after starting a work I could pause it and have reward as without it', async () => {
            const job = jobs[0]
            await setupWorker(job, users.worker)

            let initialWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)

            let postJobOfferTx = await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 200, 200, 100, { from: users.worker })
            let postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], postJobOfferTx, 'JobOfferPosted'))[0]
            assert.isDefined(postJobOfferEvent)

            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })

            await helpers.increaseTime(1*(8*60*60)) // 1 working day

            let jobPausedTx = await contracts.jobController.pauseWork(job.id, { from: users.worker })
            let jobPausedEvent = (await eventsHelper.findEvent([contracts.jobController], jobPausedTx, 'WorkPaused'))[0]
            assert.isDefined(jobPausedEvent)

            await helpers.increaseTime(2*(8*60*60)) // 2 days off

            let resumeWorkTx = await contracts.jobController.resumeWork(job.id, { from: users.worker })

            await helpers.increaseTime(3*(8*60*60)) // 1 working day

            await contracts.jobController.endWork(job.id, { from: users.worker })
            await contracts.jobController.confirmEndWork(job.id, { from: users.client })
            await contracts.jobController.releasePayment(job.id, { from: users.default })

            let afterPaymentWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker, contracts.coin.address)
            assert.notEqual(initialWorkerBalance, afterPaymentWorkerBalance)


            // ---

            const otherJob = jobs[2]
            await setupWorker(otherJob, users.worker2)

            let initialWorker2Balance = await contracts.paymentGateway.getBalance.call(users.worker2, contracts.coin.address)

            await contracts.jobController.postJobOffer(otherJob.id, contracts.coin.address, 200, 200, 100, { from: users.worker2 })
            await contracts.jobController.acceptOffer(otherJob.id, users.worker2, { from: users.client })
            await contracts.jobController.startWork(otherJob.id, { from: users.worker2 })
            await contracts.jobController.confirmStartWork(otherJob.id, { from: users.client })
            await helpers.increaseTime(4*(8*60*60)) // 4 working day
            await contracts.jobController.endWork(otherJob.id, { from: users.worker2 })
            await contracts.jobController.confirmEndWork(otherJob.id, { from: users.client })
            await contracts.jobController.releasePayment(otherJob.id, { from: users.default })

            let afterPaymentWorker2Balance = await contracts.paymentGateway.getBalance.call(users.worker2, contracts.coin.address)


            assert.equal(afterPaymentWorkerBalance.valueOf(), afterPaymentWorker2Balance.valueOf())
        })

        it('I want to leave a feedback on a client after work is done', async () => {
            const job = jobs[0]
            await setupWorker(job, users.worker)
            await bindWorkerWithBoard(users.worker, board.id)

            await contracts.jobController.postJobOffer(job.id, contracts.coin.address, 100, 100, 100, { from: users.worker })
            await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
            await contracts.jobController.startWork(job.id, { from: users.worker })
            await contracts.jobController.confirmStartWork(job.id, { from: users.client })
            await helpers.increaseTime(2*60*60) // 2 hours
            await contracts.jobController.endWork(job.id, { from: users.worker })
            await contracts.jobController.confirmEndWork(job.id, { from: users.client })

            await contracts.jobController.releasePayment(job.id, { from: users.default })

            let expectedJobRating = {}
            expectedJobRating[users.client] = 7
            await contracts.ratingLibrary.setJobRating(users.client, expectedJobRating[users.client], job.id, { from: users.worker })
            let [_worker, actualJobRating] = await contracts.ratingLibrary.getJobRating.call(users.client, job.id)
            assert.equal(_worker, users.worker)
            assert.equal(actualJobRating, expectedJobRating[users.client])
        })
    })

})
