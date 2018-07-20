const BoardController = artifacts.require('BoardController')
const Mock = artifacts.require('./Mock.sol');
const Owned = artifacts.require('Owned');
const JobController = artifacts.require('./JobController.sol');
const JobsDataProvider = artifacts.require('./JobsDataProvider.sol');
const PaymentGateway = artifacts.require('./PaymentGateway.sol');
const Roles2Library = artifacts.require('./Roles2Library.sol');
const UserLibrary = artifacts.require('./UserLibrary.sol');
const UserFactory = artifacts.require('UserFactory');
const Recovery = artifacts.require('./Recovery.sol');
const UserInterface = artifacts.require('UserInterface');
const UserBackendProvider = artifacts.require('UserBackendProvider');
const RatingsAndReputationLibrary = artifacts.require('./RatingsAndReputationLibrary.sol');

const Reverter = require('./helpers/reverter')
const eventsHelper = require('./helpers/eventsHelper')
const helpers = require('./helpers/helpers')
const ErrorsScope = require("../common/errors")

contract('Integration tests (user stories)', (accounts) => {

    const reverter = new Reverter(web3);

    const JobState = {
        NOT_SET: 0, 
        CREATED: 2**0, 
        OFFER_ACCEPTED: 2**1, 
        PENDING_START: 2**2, 
        STARTED: 2**3, 
        PENDING_FINISH: 2**4, 
        FINISHED: 2**5, 
        WORK_ACCEPTED: 2**6, 
        WORK_REJECTED: 2**7, 
        FINALIZED: 2**8,
    };

    const roles = {
        moderator: 77,
        worker: 33,
        client: 18,
        validator: 4
    }

    const tmFlow = web3.toBigNumber(2).pow(255).add(1) /// WORKFLOW_TM + CONFIRMATION

    const users = {
        default: accounts[0],
        contractOwner: accounts[0],
        root: accounts[5],
        moderator: accounts[4],
        client: accounts[2],
        worker: accounts[7],
        worker2: accounts[8],
        recovery: accounts[3],
    }
    var contracts = {}

    var board = {
        id: null,
        name: 'My and your jobs',
        description: 'Board desription from the bottom of a heart',
        tags: 1,
        tagsArea: 1,
        tagsCategory: 1,
        ipfsHash: "ipfsHash"
    }

    var jobs = [
        {
            id: null,
            flow: tmFlow,
            area: 4,
            category: 4,
            skills: 4,
            defaultPay: 90,
            details: '0x00bb00bb00bb00bb00bb'
        },
        {
            id: null,
            flow: tmFlow,
            area: 4,
            category: 4,
            skills: 8,
            defaultPay: 90,
            details: '0x00aa00aa00aa00aa00aa'
        },
        {
            id: null,
            flow: tmFlow,
            area: 4,
            category:4,
            skills: 4,
            defaultPay: 90,
            details: '0x00ee00ee00ee00ee00ee'
        },
        {
            id: null,
            flow: tmFlow,
            area: 16,
            category: 16,
            skills: 32,
            defaultPay: 90,
            details: '0x00ff00ff00ff00ff00ff'
        },
        {
            id: null,
            flow: tmFlow,
            area: 4,
            category: 16,
            skills: 4,
            defaultPay: 90,
            details: '0x00fe00fe00fe00fe00fe'
        },
        {
            id: null,
            flow: tmFlow,
            area: 16,
            category: 4,
            skills: 4,
            defaultPay: 90,
            details: '0x00fe00fe00fe00fe00fe'
        },
    ]

    const setupJob = async (_job, _client = users.client, _depositBalance = 1000000000) => {
        const postJobTx = await contracts.jobController.postJob(_job.flow, _job.area, _job.category, _job.skills, _job.defaultPay, _job.details, { from: _client })
        const postJobEvent = (await eventsHelper.findEvent([contracts.jobController], postJobTx, "JobPosted"))[0]

        let jobId = postJobEvent.args.jobId
        assert.isNotNull(jobId)

        return jobId
    }

    const setupBoard = async (_board) => {
        const boardTx = await contracts.boardController.createBoard(board.tags, board.tagsArea, board.tagsCategory, board.ipfsHash, { from: users.moderator })
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
        await contracts.userLibrary.setMany(_worker, _job.area, [_job.category], [_job.skills], { from: users.root })
        return _worker
    }

    const bindWorkerWithBoard = async (_user, _boardId) => {
        await contracts.boardController.bindUserWithBoard(_boardId, _user)
        let status = await contracts.boardController.getUserStatus.call(_boardId, _user)
        assert.isTrue(status)
    }

    const setupBoardWithJobs = async (/*board = board, jobs = jobs*/) => {
        board.id = await setupBoard(board)
        
        for (var i = 0; i < jobs.length; ++i) {
            const job = jobs[i]
            let jobId = await setupJob(job)
            jobs[i].id = jobId
            
            await bindJobWithBoard(jobId, board.id)
        }
    }

    const cleanUpBoards = (/*board = board, jobs = jobs*/) => {
        board.id = null
        jobs.forEach((e,idx) => jobs[idx].id = null)
    }

    before('setup', async () => {
        contracts.boardController = await BoardController.deployed()
        contracts.rolesLibrary = await Roles2Library.deployed()
        contracts.userLibrary = await UserLibrary.deployed()
        contracts.userFactory = await UserFactory.deployed()
        contracts.recovery = await Recovery.deployed()
        contracts.ratingLibrary = await RatingsAndReputationLibrary.deployed()
        contracts.jobController = await JobController.deployed()
        contracts.jobsDataProvider = await JobsDataProvider.deployed()
        contracts.mock = await Mock.deployed()
        contracts.paymentGateway = await PaymentGateway.deployed()

        await contracts.ratingLibrary.setBoardController(contracts.boardController.address, { from: users.default })
        await contracts.ratingLibrary.setJobController(contracts.jobsDataProvider.address, { from: users.default })
        await contracts.ratingLibrary.setUserLibrary(contracts.userLibrary.address, { from: users.default })

        await contracts.rolesLibrary.setRootUser(users.root, true, { from: users.contractOwner })
        await contracts.rolesLibrary.setRootUser(users.default, false, { from: users.contractOwner })

        const createBoardData = contracts.boardController.contract.createBoard.getData(0,0,0,0).slice(0,10)
        const closeBoardData = contracts.boardController.contract.closeBoard.getData(0).slice(0,10)
        await contracts.rolesLibrary.addRoleCapability(roles.moderator, contracts.boardController.address, createBoardData, { from: users.contractOwner })
        await contracts.rolesLibrary.addRoleCapability(roles.moderator, contracts.boardController.address, closeBoardData, { from: users.contractOwner })
        await contracts.rolesLibrary.addUserRole(users.moderator, roles.moderator, { from: users.root })

        await reverter.snapshot()
    })

    context("as an admin", () => {

        describe.skip("I want to be able to setup other admins", () => {

            after(async () => {
                await reverter.revert()
            })

            it("`default` user should not be a root user", async () => {
                assert.isFalse(await contracts.rolesLibrary.isUserRoot.call(users.default))
            })

            it("`root` user should be root", async () => {
                assert.isTrue(await contracts.rolesLibrary.isUserRoot.call(users.root))
            })

            it("should be able to set other user as an admin with OK code", async () => {
                assert.equal((await contracts.ratingLibrary.setRootUser.call(users.default, true, { from: users.contractOwner, })))
            })
        })

        describe("I want to be able to create boards", () => {

            after(async () => {
                await reverter.revert()
            })

            it("`root` user should be root user", async () => {
                assert.isTrue(await contracts.rolesLibrary.isUserRoot.call(users.root))
            })

            it("root user should have no role capabilities for `createBoard` method", async () => {
                const createBoardData = contracts.boardController.contract.createBoard.getData(0,0,0,0).slice(0,10)
                const roles = await contracts.rolesLibrary.getUserRoles.call(users.root)
                const capabilities = await contracts.rolesLibrary.getCapabilityRoles.call(contracts.boardController.address, createBoardData)

                assert.equal((await contracts.mock.bitAndBytes32ToBytes32.call(roles, capabilities)).toNumber(), 0)
            })

            it("should be able to create a board with OK code", async () => {
                assert.equal((await contracts.boardController.createBoard.call(board.tags, board.tagsArea, board.tagsCategory, board.ipfsHash, { from: users.root, })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to create a board", async () => {
                const tx = await contracts.boardController.createBoard(board.tags, board.tagsArea, board.tagsCategory, board.ipfsHash, { from: users.root, })
                const createBoardEvent = (await eventsHelper.findEvent([contracts.boardController,], tx, 'BoardCreated'))[0]
                assert.isDefined(createBoardEvent)
            })
        })

        describe("I want to be able to close boards", () => {
            let boardId

            before(async () => {
                const tx = await contracts.boardController.createBoard(board.tags, board.tagsArea, board.tagsCategory, board.ipfsHash, { from: users.root, })
                const createBoardEvent = (await eventsHelper.findEvent([contracts.boardController,], tx, 'BoardCreated'))[0]
                boardId = createBoardEvent.args.boardId
            })

            after(async () => {
                await reverter.revert()
            })

            it("`root` user should be root user", async () => {
                assert.isTrue(await contracts.rolesLibrary.isUserRoot.call(users.root))
            })

            it("should be able to close board with OK code", async () => {
                assert.equal((await contracts.boardController.closeBoard.call(boardId, { from: users.root, })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to close board", async () => {
                const tx = await contracts.boardController.closeBoard(boardId, { from: users.root, })
                const closeBoardEvent = (await eventsHelper.findEvent([contracts.boardController,], tx, 'BoardClosed'))[0]
                assert.isDefined(closeBoardEvent)
            })
        })

        describe("I want to be able to set fee address destination in payment gateway", () => {
            const feeAddress = "0xfeeaddfeeaddfeeaddfeeaddfeeaddfeeaddfeea"

            after(async () => {
                await reverter.revert()
            })

            it("`root` user should be root user", async () => {
                assert.isTrue(await contracts.rolesLibrary.isUserRoot.call(users.root))
            })

            it("should have different fee address in payment gateway", async () => {
                assert.notEqual((await contracts.paymentGateway.getFeeAddress.call()), feeAddress)
            })

            it("root user should be able to update fee address with OK code", async () => {
                assert.equal((await contracts.paymentGateway.setFeeAddress.call(feeAddress, { from: users.root, })).toNumber(), ErrorsScope.OK)
            })

            it("root user should be able to update fee address", async () => {
                await contracts.paymentGateway.setFeeAddress(feeAddress, { from: users.root, })

                assert.equal((await contracts.paymentGateway.getFeeAddress.call()), feeAddress)
            })
        })
    })

    context.skip("as a validator TODO", () => { })

    context('as a client', () => {

        describe("I want to wait for offers and", () => {
            const workers = [users.worker, users.worker2]
            let job

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]
                for (const _worker of workers) {
                    await setupWorker(job, _worker)
                }
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("job should have `Created` state", async () => {
                const jobState = await contracts.jobsDataProvider.getJobState.call(job.id)
                assert.equal(jobState, JobState.CREATED)
            })

            it("worker should be able to post an offer with OK code", async () => {
                assert.equal((await contracts.jobController.postJobOffer.call(job.id, 100, 100, 100, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("worker should be able to post an offer", async () => {
                const tx = await contracts.jobController.postJobOffer(job.id, 100, 100, 100, { from: users.worker })
                const jobOfferPostedEvent = (await eventsHelper.findEvent([contracts.jobController,], tx, "JobOfferPosted"))[0]
                assert.isDefined(jobOfferPostedEvent)
            })

            it("other worker should also be able to post an offer with OK code", async () => {
                assert.equal((await contracts.jobController.postJobOffer.call(job.id, 90, 110, 80, { from: users.worker2 })).toNumber(), ErrorsScope.OK)
            })

            it("other worker should also be able to post an offer", async () => {
                const tx = await contracts.jobController.postJobOffer(job.id, 90, 110, 80, { from: users.worker2 })
                const jobOfferPostedEvent = (await eventsHelper.findEvent([contracts.jobController,], tx, "JobOfferPosted"))[0]
                assert.isDefined(jobOfferPostedEvent)
            })

            it("shouldn't be able to accept second offer with OK code if no enough value")

            it("should be able to accept second offer with OK code", async () => {
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker2, job.id)
                assert.equal((await contracts.jobController.acceptOffer.call(job.id, users.worker2, { from: users.client , value: payment})).toNumber(), ErrorsScope.OK)
            })

            it("should be able to accept second offer", async () => {
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker2, job.id)
                const acceptWorkerTx = await contracts.jobController.acceptOffer(job.id, users.worker2, { from: users.client, value: payment})
                const acceptJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], acceptWorkerTx, "JobOfferAccepted"))[0]
                assert.isDefined(acceptJobOfferEvent)
            })

            it("should THROW when trying to accept other offer", async () => {
                try {
                    const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                    await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client })
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }
            })
        })

        describe("I want to cancel a job after a worker started and", () => {
            let job
            let initialWorkerBalance

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]
                await setupWorker(job, users.worker)

                await contracts.jobController.postJobOffer(job.id, 100, 100, 100, { from: users.worker })

                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})
                await contracts.jobController.startWork(job.id, { from: users.worker })
                await contracts.jobController.confirmStartWork(job.id, { from: users.client })
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("some time should pass", async () => {
                await helpers.increaseTime(4*60*60) // 4 hours
            })

            it("should be possibe to cancel job with OK code", async () => {
                assert.equal((await contracts.jobController.cancelJob.call(job.id, { from: users.client })).toNumber(), ErrorsScope.OK)
            })

            it("should be possibe to cancel job", async () => {
                initialWorkerBalance = await helpers.getEthBalance(users.worker)

                const tx = await contracts.jobController.cancelJob(job.id, { from: users.client })
                const jobCancelledEvent = (await eventsHelper.findEvent([contracts.jobController,], tx, "JobCanceled"))[0]
                assert.isDefined(jobCancelledEvent)
            })

            it("job should have `Finalized` state", async () => {
                const jobState = await contracts.jobsDataProvider.getJobState.call(job.id)
                assert.equal(jobState, JobState.FINALIZED)
            })

            it("should have increased worker's balance after the payment", async () => {
                const afterPaymentWorkerBalance = await helpers.getEthBalance(users.worker)
                assert.isTrue(afterPaymentWorkerBalance.gt(initialWorkerBalance))
            })
        })

        describe("I want to be able to extend work time by increasing estimated time", async () => {
            let job
            let otherJob
            let initialWorkerBalance
            let initialWorker2Balance

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]
                await setupWorker(job, users.worker)

                initialWorkerBalance = await contracts.paymentGateway.getBalance.call(users.worker)
                assert.equal(initialWorkerBalance, 0)

                otherJob = jobs[2]
                await setupWorker(otherJob, users.worker2)

                initialWorker2Balance = await contracts.paymentGateway.getBalance.call(users.worker2)
                assert.equal(initialWorker2Balance, 0)
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            let afterPaymentWorkerEthPayment

            it("worker without increasing time should receive his payment after finishing work", async () => {
                await contracts.jobController.postJobOffer(job.id, 100, 100, 100, { from: users.worker })
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})
                await contracts.jobController.startWork(job.id, { from: users.worker })
                await contracts.jobController.confirmStartWork(job.id, { from: users.client })
                await helpers.increaseTime(4*60*60) // 4 hours
                await contracts.jobController.endWork(job.id, { from: users.worker })
                await contracts.jobController.confirmEndWork(job.id, { from: users.client })

                const workerEthBalance = await helpers.getEthBalance(users.worker)

                await contracts.jobController.releasePayment(job.id, { from: users.default })

                afterPaymentWorkerEthPayment = (await helpers.getEthBalance(users.worker)).sub(workerEthBalance)
                assert.notEqual(afterPaymentWorkerEthPayment.toString(16), '0')
            })

            it("the other worker should be able to apply for a job", async () => {
                await contracts.jobController.postJobOffer(otherJob.id, 100, 100, 100, { from: users.worker2 })
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker2, otherJob.id)
                await contracts.jobController.acceptOffer(otherJob.id, users.worker2, { from: users.client, value: payment})
                await contracts.jobController.startWork(otherJob.id, { from: users.worker2 })
                await contracts.jobController.confirmStartWork(otherJob.id, { from: users.client })

                const jobState = await contracts.jobsDataProvider.getJobState.call(otherJob.id)
                assert.equal(jobState, JobState.STARTED)
            })

            it("some time should pass", async () => {
                await helpers.increaseTime(1*60*60) // 1 hour
            })

            it("should be able to add more time for a job with OK code", async () => {
                const additionalTime = 150;
                await contracts.jobController.submitAdditionalTimeRequest(otherJob.id, additionalTime, { from: users.worker2, })
                const additionalPayment = await contracts.jobController.calculateLock(users.worker2, otherJob.id, additionalTime, 0)
                assert.equal(
                    (await contracts.jobController.acceptAdditionalTimeRequest.call(otherJob.id, additionalTime, { from: users.client, value: additionalPayment, })).toNumber(), 
                    ErrorsScope.OK
                )
            })

            it("should be able to add more time for a job", async () => {
                const additionalTime = 150;
                const additionalPayment = await contracts.jobController.calculateLock(users.worker2, otherJob.id, additionalTime, 0)
                const tx = await contracts.jobController.acceptAdditionalTimeRequest(otherJob.id, additionalTime, { from: users.client, value: additionalPayment, })
                const timeAddedEvent = (await eventsHelper.findEvent([contracts.jobController,], tx, "TimeRequestAccepted"))[0]
                assert.isDefined(timeAddedEvent)
            })

            it("some time should pass", async () => {
                await helpers.increaseTime(3*60*60) // 3 hours
            })

            it("the other worker should be able to finish the job", async () => {
                await contracts.jobController.endWork(otherJob.id, { from: users.worker2 })
                await contracts.jobController.confirmEndWork(otherJob.id, { from: users.client })

                const jobState = await contracts.jobsDataProvider.getJobState.call(otherJob.id)
                assert.equal(jobState, JobState.FINISHED)
            })

            let afterPaymentWorker2EthPayment

            it("the other worker should be able to receive a payment for his work", async () => {
                const workerEthBalance = await helpers.getEthBalance(users.worker2)
                await contracts.jobController.releasePayment(otherJob.id, { from: users.default })

                afterPaymentWorker2EthPayment = (await helpers.getEthBalance(users.worker2)).sub(workerEthBalance)
                assert.notEqual(afterPaymentWorker2EthPayment.toString(16), '0')
            })

            it("the second worker should receive more payment than the first despite working the same hours", async () => {
                assert.isTrue(afterPaymentWorker2EthPayment.gt(afterPaymentWorkerEthPayment))
            })
        })

        describe("I want to give feedback on worker's labor and", () => {
            let job
            let expectedWorkerRating = {}
            let skillRatings = {}

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]
                await setupWorker(job, users.worker)
                await bindWorkerWithBoard(users.worker, board.id)

                expectedWorkerRating[users.worker] = 9
                skillRatings[job.skills] = 8

                await contracts.jobController.postJobOffer(job.id, 100, 100, 100, { from: users.worker })
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})
                await contracts.jobController.startWork(job.id, { from: users.worker })
                await contracts.jobController.confirmStartWork(job.id, { from: users.client })
                await helpers.increaseTime(2*60*60) // 2 hours
                await contracts.jobController.endWork(job.id, { from: users.worker })
                await contracts.jobController.confirmEndWork(job.id, { from: users.client })

                await contracts.jobController.releasePayment(job.id, { from: users.default })
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("a job should have been finalized", async () => {
                const jobState = await contracts.jobsDataProvider.getJobState.call(job.id)
                assert.equal(jobState, JobState.FINALIZED)
            })

            it("should have no rating set up for worker by the client", async () => {
                assert.equal((await contracts.ratingLibrary.getUserRating.call(users.client, users.worker)).toNumber(), 0)
            })

            it("should be able to setup worker's rating with OK code", async () => {
                assert.equal((await contracts.ratingLibrary.setUserRating.call(users.worker, expectedWorkerRating[users.worker], { from: users.client })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to setup worker's rating", async () => {
                const tx = await contracts.ratingLibrary.setUserRating(users.worker, expectedWorkerRating[users.worker], { from: users.client })
                const userRatingGivenEvent = (await eventsHelper.findEvent([contracts.ratingLibrary,], tx, "UserRatingGiven"))[0]
                assert.isDefined(userRatingGivenEvent)

                assert.equal((await contracts.ratingLibrary.getUserRating.call(users.client, users.worker)).toNumber(), expectedWorkerRating[users.worker])
            })

            it("should be able to update worker's rating", async () => {
                expectedWorkerRating[users.worker] = 5

                const tx = await contracts.ratingLibrary.setUserRating(users.worker, expectedWorkerRating[users.worker], { from: users.client })
                const userRatingGivenEvent = (await eventsHelper.findEvent([contracts.ratingLibrary,], tx, "UserRatingGiven"))[0]
                assert.isDefined(userRatingGivenEvent)

                assert.equal((await contracts.ratingLibrary.getUserRating.call(users.client, users.worker)).toNumber(), expectedWorkerRating[users.worker])
            })

            it("should have no skill rating for the worker set by the client", async () => {
                let [ _client, skillRating, ] = await contracts.ratingLibrary.getSkillRating.call(users.worker, job.area, job.category, job.skills, job.id)
                assert.equal(_client, 0)
                assert.equal(skillRating, 0)
            })

            it("should be able to set up skill rating for the worker with OK code", async () => {
                assert.equal((await contracts.ratingLibrary.rateWorkerSkills.call(job.id, users.worker, job.area, job.category, [job.skills], [skillRatings[job.skills]], { from: users.client })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to set up skill rating for the worker", async () => {
                const tx = await contracts.ratingLibrary.rateWorkerSkills(job.id, users.worker, job.area, job.category, [job.skills], [skillRatings[job.skills]], { from: users.client })
                const skillRatingGivenEvent = (await eventsHelper.findEvent([contracts.ratingLibrary,], tx, "SkillRatingGiven"))[0]
                assert.isDefined(skillRatingGivenEvent)

                let [ _client, skillRating, ] = await contracts.ratingLibrary.getSkillRating.call(users.worker, job.area, job.category, job.skills, job.id)
                assert.equal(_client, users.client)
                assert.equal(skillRatings[job.skills], skillRating)
            })

            const updatedSkillRatingSkills =  10

            it("shouldn't be able to update skill rating for the worker with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                assert.equal((await contracts.ratingLibrary.rateWorkerSkills.call(job.id, users.worker, job.area, job.category, [job.skills], [updatedSkillRatingSkills,], { from: users.client })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("shouldn't be able to update skill rating for the worker", async () => {
                const tx = await contracts.ratingLibrary.rateWorkerSkills(job.id, users.worker, job.area, job.category, [job.skills], [updatedSkillRatingSkills,], { from: users.client })
                const skillRatingGivenEvent = (await eventsHelper.findEvent([contracts.ratingLibrary,], tx, "SkillRatingGiven"))[0]
                assert.isUndefined(skillRatingGivenEvent)

                let [ _client, skillRating, ] = await contracts.ratingLibrary.getSkillRating.call(users.worker, job.area, job.category, job.skills, job.id)
                assert.equal(_client, users.client)
                assert.equal(skillRatings[job.skills], skillRating)
            })
        })
    })

    context('as a worker', async () => {

        describe("I want to find a job and make an offer", async () => {
            let workerExpertise
            let appropriateJobIds = []

            before(async () => {
                await setupBoardWithJobs()
                workerExpertise = jobs[0]

                await setupWorker(workerExpertise, users.worker)

            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("should be able to find appropriate job offers", async () => {
                const jobsCount = await contracts.jobsDataProvider.getJobsCount.call()
                const jobsIds = [...Array.apply(null, { length: jobsCount }).keys()].map(id => id + 1);

                for (const jobId of jobsIds) {
                    let jobSkillsArea = await contracts.jobsDataProvider.getJobSkillsArea.call(jobId)
                    let jobSkillsCategory = await contracts.jobsDataProvider.getJobSkillsCategory.call(jobId)
                    let jobSkills = await contracts.jobsDataProvider.getJobSkills.call(jobId)
                    let jobState = await contracts.jobsDataProvider.getJobState.call(jobId)
    
                    if (jobState != JobState.CREATED) {
                        continue
                    }
    
                    if (jobSkillsArea != workerExpertise.area ||
                        jobSkillsCategory != workerExpertise.category ||
                        jobSkills != workerExpertise.skills)
                    {
                        continue
                    }
    
                    appropriateJobIds.push(jobId)
                    
                }

                assert.notEqual(appropriateJobIds.length, 0)
            })

            let gotJobId

            it("should be able to post an offer with OK code", async () => {
                gotJobId = appropriateJobIds[Math.floor(Math.random()*appropriateJobIds.length)];
                assert.equal((await contracts.jobController.postJobOffer.call(gotJobId, 200, 200, 100, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to post an offer", async () => {
                let tx = await contracts.jobController.postJobOffer(gotJobId, 200, 200, 100, { from: users.worker })
                let postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })
        })

        describe("I want to have a reward after finishing a job", () => {
            let job
            let initialWorkerBalance

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]

                await setupWorker(job, users.worker)

                await contracts.jobController.postJobOffer(job.id, 200, 200, 100, { from: users.worker })
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("should be able to start work with OK code", async () => {
                assert.equal((await contracts.jobController.startWork.call(job.id, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("job should have `Accepted` state", async () => {
                assert.equal((await contracts.jobsDataProvider.getJobState.call(job.id)).toNumber(), JobState.OFFER_ACCEPTED)
            })

            it("should be able to start work", async () => {
                await contracts.jobController.startWork(job.id, { from: users.worker })

                assert.equal((await contracts.jobsDataProvider.getJobState.call(job.id)).toNumber(), JobState.PENDING_START)
            })

            it("should be able to confirm work is started by client", async () => {
                await contracts.jobController.confirmStartWork(job.id, { from: users.client })

                assert.equal((await contracts.jobsDataProvider.getJobState.call(job.id)).toNumber(), JobState.STARTED)
            })

            it("some time should pass", async () => {
                await helpers.increaseTime(20*(8*60*60)) // 20 working days
            })

            it("should end work when it is ready with OK code", async () => {
                assert.equal((await contracts.jobController.endWork.call(job.id, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("should end work when it is ready", async () => {
                await contracts.jobController.endWork(job.id, { from: users.worker })

                assert.equal((await contracts.jobsDataProvider.getJobState.call(job.id)).toNumber(), JobState.PENDING_FINISH)
            })

            it("should have confirmation about finishing work from client", async () => {
                await contracts.jobController.confirmEndWork(job.id, { from: users.client })

                assert.equal((await contracts.jobsDataProvider.getJobState.call(job.id)).toNumber(), JobState.FINISHED)
            })

            it("should receive payment for the work", async () => {
                initialWorkerBalance = await helpers.getEthBalance(users.worker)

                await contracts.jobController.releasePayment(job.id, { from: users.default })

                const afterPaymentWorkerBalance = await helpers.getEthBalance(users.worker)
                assert.isTrue(afterPaymentWorkerBalance.gt(initialWorkerBalance))
            })

            it("should be able withdraw payment for the work")
        })

        describe("I want to apply for different jobs if they are in different periods", () => {
            let workerExpertise
            let appropriateJobIds = []

            before(async () => {
                await setupBoardWithJobs()
                workerExpertise = jobs[0]

                await setupWorker(workerExpertise, users.worker)
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("should have at least 2 job posts", async () => {
                const jobsCount = await contracts.jobsDataProvider.getJobsCount.call()
                const jobsIds = [...Array.apply(null, { length: jobsCount }).keys()].map(id => id + 1);

                for (const jobId of jobsIds) {
                    const jobSkillsArea = await contracts.jobsDataProvider.getJobSkillsArea.call(jobId)
                    const jobSkillsCategory = await contracts.jobsDataProvider.getJobSkillsCategory.call(jobId)
                    const jobSkills = await contracts.jobsDataProvider.getJobSkills.call(jobId)
                    const jobState = await contracts.jobsDataProvider.getJobState.call(jobId)
    
                    if (jobState != JobState.CREATED) {
                        continue
                    }
    
                    if (jobSkillsArea != workerExpertise.area ||
                        jobSkillsCategory != workerExpertise.category ||
                        jobSkills != workerExpertise.skills)
                    {
                        continue
                    }
    
                    appropriateJobIds.push(jobId)
                    
                }

                assert.isAtLeast(appropriateJobIds.length, 2)
            })

            it("should be able to apply for the first job", async () => {
                const jobId = appropriateJobIds[0]

                const tx = await contracts.jobController.postJobOffer(jobId, 200, 200, 100, { from: users.worker })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })

            it("should be able to apply for the second job", async () => {
                const jobId = appropriateJobIds[1]

                const tx = await contracts.jobController.postJobOffer(jobId, 200, 200, 100, { from: users.worker })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })
        })

        describe("I want to participate in job\'s trades and apply a competitive offer (several times by increasing or decreasing value)", () => {
            let job

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]

                await setupWorker(job, users.worker)
                await setupWorker(job, users.worker2)

                await contracts.jobController.postJobOffer(job.id, 100, 100, 100, { from: users.worker })
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("other worker should be able to post job offer with OK code", async () => {
                assert.equal((await contracts.jobController.postJobOffer.call(job.id, 95, 100, 90, { from: users.worker2 })).toNumber(), ErrorsScope.OK)
            })

            it("other worker should be able to post job offer", async () => {
                const tx = await contracts.jobController.postJobOffer(job.id, 95, 100, 90, { from: users.worker2 })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })

            it("worker should be able to update his job offer with OK code", async () => {
                assert.equal((await contracts.jobController.postJobOffer.call(job.id, 90, 100, 90, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("worker should be able to update his job offer", async () => {
                const tx = await contracts.jobController.postJobOffer(job.id, 90, 100, 90, { from: users.worker })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })

            it("other worker should be able to update his job offer with OK code", async () => {
                assert.equal((await contracts.jobController.postJobOffer.call(job.id, 80, 95, 85, { from: users.worker2 })).toNumber(), ErrorsScope.OK)
            })

            it("other worker should be able to update his job offer", async () => {
                const tx = await contracts.jobController.postJobOffer(job.id, 80, 95, 85, { from: users.worker2 })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })

            it("worker should be able to update his job offer with OK code", async () => {
                assert.equal((await contracts.jobController.postJobOffer.call(job.id, 90, 80, 80, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("worker should be able to update his job offer", async () => {
                const tx = await contracts.jobController.postJobOffer(job.id, 90, 80, 80, { from: users.worker })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)
            })

            let notExpectedPreviousLockedAmount = ((90 * (60 + 100) + 90) / 10) * 11
            let expectedLastLockedAmount = ((90 * (60 + 80) + 80) / 10) * 11

            it("client should accept worker's offer instead of other worker's offer", async () => {
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                const tx = await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})
                const jobOfferAccepted = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobOfferAccepted'))[0]
                assert.isDefined(jobOfferAccepted)
            })

            it("jobController should not lock previouly offered amount", async () => {
                assert.isBelow((await contracts.jobController.calculateLockAmount.call(job.id)).toNumber(), notExpectedPreviousLockedAmount)
            })

            it("jobController should lock accepted amount", async () => {
                assert.equal((await contracts.jobController.calculateLockAmount.call(job.id)).toNumber(), expectedLastLockedAmount)
            })

            it("client shouldn't be able to change his mind with job offer", async () => {
                try {
                    const payment = await contracts.jobController.calculateLockAmountFor(users.worker2, job.id)
                    await contracts.jobController.acceptOffer(job.id, users.worker2, { from: users.client, value: payment})
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }
            })
        })

        describe("I want that after starting a work I could pause it and have reward as without it", async () => {
            let job
            let otherJob
            let initialWorkerBalance
            let initialWorker2Balance

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]

                await setupWorker(job, users.worker)

                const postJobOfferTx = await contracts.jobController.postJobOffer(job.id, 200, 200, 100, { from: users.worker })
                const postJobOfferEvent = (await eventsHelper.findEvent([contracts.jobController], postJobOfferTx, 'JobOfferPosted'))[0]
                assert.isDefined(postJobOfferEvent)

                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})
                await contracts.jobController.startWork(job.id, { from: users.worker })
                await contracts.jobController.confirmStartWork(job.id, { from: users.client })

                // ---

                otherJob = jobs[2]
                await setupWorker(otherJob, users.worker2)
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("some time should pass working", async () => {
                await helpers.increaseTime(1*(8*60*60)) // 1 working day
            })

            it("should be able to pause work with OK code", async () => {
                assert.equal((await contracts.jobController.pauseWork.call(job.id, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to pause work", async () => {
                let tx = await contracts.jobController.pauseWork(job.id, { from: users.worker })
                let jobPausedEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'WorkPaused'))[0]
                assert.isDefined(jobPausedEvent)
            })

            it("some time should pass resting", async () => {
                await helpers.increaseTime(2*(8*60*60)) // 2 days off
            })

            it("should be able to resume work with OK code", async () => {
                assert.equal((await contracts.jobController.resumeWork.call(job.id, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to resume work", async () => {
                let tx = await contracts.jobController.resumeWork(job.id, { from: users.worker })
                let jobResumedEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'WorkResumed'))[0]
                assert.isDefined(jobResumedEvent)
            })

            it("some time should pass working", async () => {
                await helpers.increaseTime(3*(8*60*60)) // 1 working day
            })

            it("should be able to finish work", async () => {
                await contracts.jobController.endWork(job.id, { from: users.worker })
                await contracts.jobController.confirmEndWork(job.id, { from: users.client })

                initialWorkerBalance = await helpers.getEthBalance(users.worker)
                await contracts.jobController.releasePayment(job.id, { from: users.default })
            })

            let totalPaidSumWorker

            it("worker should receive his payment check", async () => {
                const currentBalance = await helpers.getEthBalance(users.worker)
                assert.isTrue(currentBalance.gt(initialWorkerBalance))

                totalPaidSumWorker = currentBalance.sub(initialWorkerBalance)
            })

            it("other worker should be able to perform his work during the same period but without pauses", async () => {
                await contracts.jobController.postJobOffer(otherJob.id, 200, 200, 100, { from: users.worker2 })
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker2, otherJob.id)
                await contracts.jobController.acceptOffer(otherJob.id, users.worker2, { from: users.client, value:payment})
                await contracts.jobController.startWork(otherJob.id, { from: users.worker2 })
                await contracts.jobController.confirmStartWork(otherJob.id, { from: users.client })
                await helpers.increaseTime(4*(8*60*60)) // 4 working day
                await contracts.jobController.endWork(otherJob.id, { from: users.worker2 })
                await contracts.jobController.confirmEndWork(otherJob.id, { from: users.client })

                initialWorker2Balance = await helpers.getEthBalance(users.worker2)

                await contracts.jobController.releasePayment(otherJob.id, { from: users.default })

                assert.equal((await contracts.jobsDataProvider.getJobState.call(job.id)).toNumber(), JobState.FINALIZED)
            })

            it("other worker should have the same reward as the first worker", async () => {
                const totalPaidSumWorker2 = (await helpers.getEthBalance(users.worker2)).sub(initialWorker2Balance)

                assert.equal(totalPaidSumWorker2.toString(16), totalPaidSumWorker.toString(16))
            })
        })

        describe("I want to leave a feedback on a client after work is done", () => {
            let job
            let expectedJobRating = {}

            before(async () => {
                await setupBoardWithJobs()
                job = jobs[0]

                await setupWorker(job, users.worker)
                await bindWorkerWithBoard(users.worker, board.id)

                expectedJobRating[users.client] = 8
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            it("should not be able to leave feedback after posting job offer with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                await contracts.jobController.postJobOffer(job.id, 100, 100, 100, { from: users.worker })

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("should not be able to leave feedback after accepting job offer with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                const payment = await contracts.jobController.calculateLockAmountFor(users.worker, job.id)
                await contracts.jobController.acceptOffer(job.id, users.worker, { from: users.client, value: payment})

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("should not be able to leave feedback after starting work with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                await contracts.jobController.startWork(job.id, { from: users.worker })

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("should not be able to leave feedback after confirming work start with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                await contracts.jobController.confirmStartWork(job.id, { from: users.client })

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("some time should pass", async () => {
                await helpers.increaseTime(2*60*60) // 2 hours
            })

            it("should not be able to leave feedback after ending work with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                await contracts.jobController.endWork(job.id, { from: users.worker })

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("should not be able to leave feedback after confirming work end with RATING_AND_REPUTATION_CANNOT_SET_RATING code", async () => {
                await contracts.jobController.confirmEndWork(job.id, { from: users.client })

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_CANNOT_SET_RATING)
            })

            it("should be able to leave feedback after finalizing payment for a work with OK code", async () => {
                await contracts.jobController.releasePayment(job.id, { from: users.default })

                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, expectedJobRating[users.client], job.id, { from: users.worker })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to leave feedback after finalizing payment for a work", async () => {
                const tx = await contracts.ratingLibrary.setJobRating(users.client, expectedJobRating[users.client], job.id, { from: users.worker })
                let jobRatingGivenEvent = (await eventsHelper.findEvent([contracts.ratingLibrary,], tx, 'JobRatingGiven'))[0]
                assert.isDefined(jobRatingGivenEvent)

                let [ _worker, actualJobRating, ] = await contracts.ratingLibrary.getJobRating.call(users.client, job.id)
                assert.equal(_worker, users.worker)
                assert.equal(actualJobRating, expectedJobRating[users.client])
            })

            const otherRatingValue = 2

            it("shouldn't be able to update feedback rating after it was setup with RATING_AND_REPUTATION_RATING_IS_ALREADY_SET code", async () => {
                assert.equal((await contracts.ratingLibrary.setJobRating.call(users.client, otherRatingValue, job.id, { from: users.worker })).toNumber(), ErrorsScope.RATING_AND_REPUTATION_RATING_IS_ALREADY_SET)
            })

            it("should be able to leave feedback after finalizing payment for a work", async () => {
                const tx = await contracts.ratingLibrary.setJobRating(users.client, otherRatingValue, job.id, { from: users.worker })
                let jobRatingGivenEvent = (await eventsHelper.findEvent([contracts.jobController], tx, 'JobRatingGiven'))[0]
                assert.isUndefined(jobRatingGivenEvent)

                let [ _worker, actualJobRating, ] = await contracts.ratingLibrary.getJobRating.call(users.client, job.id)
                assert.equal(_worker, users.worker)
                assert.equal(actualJobRating, expectedJobRating[users.client])
            })
        })

        describe("I cannot post a job offer if I does not have enough skills", () => {
            let applicableJob
            var notApplicableJob


            before(async () => {
                await setupBoardWithJobs()
                applicableJob = jobs[0]

                await setupWorker(applicableJob, users.worker)
            })

            after(async () => {
                cleanUpBoards()
                await reverter.revert()
            })

            describe("match all skills", async () => {

                it("should be able to post an offer for a job if have enough skill with OK code", async () => {
                    assert.equal((await contracts.jobController.postJobOffer.call(applicableJob.id, 200, 200, 100, { from: users.worker })).toNumber(), ErrorsScope.OK)
                })
            })

            describe("no areas", async () => {

                before(async () => {
                    notApplicableJob = jobs[5]
                })

                it("should not be able to post an offer for a job if does not have enough skills for it with JOB_CONTROLLER_INVALID_SKILLS code", async () => {
                    assert.equal((await contracts.jobController.postJobOffer.call(notApplicableJob.id, 200, 200, 100, { from: users.worker })).toNumber(), ErrorsScope.JOB_CONTROLLER_INVALID_SKILLS)
                })
            })

            describe("no categories", async () => {

                before(async () => {
                    notApplicableJob = jobs[4]
                })

                it("should not be able to post an offer for a job if does not have enough skills for it with JOB_CONTROLLER_INVALID_SKILLS code", async () => {
                    assert.equal((await contracts.jobController.postJobOffer.call(notApplicableJob.id, 200, 200, 100, { from: users.worker })).toNumber(), ErrorsScope.JOB_CONTROLLER_INVALID_SKILLS)
                })
            })

            describe("no skills", async () => {

                before(async () => {
                    notApplicableJob = jobs[1]
                })

                it("should not be able to post an offer for a job if does not have enough skills for it with JOB_CONTROLLER_INVALID_SKILLS code", async () => {
                    assert.equal((await contracts.jobController.postJobOffer.call(notApplicableJob.id, 200, 200, 100, { from: users.worker })).toNumber(), ErrorsScope.JOB_CONTROLLER_INVALID_SKILLS)
                })
            })
        })
    })

    context("as a user", () => {
        let userRecoveryAddress
        const userMainAddress = users.worker
        const userNewAddress = users.recovery
        const oracle = users.moderator
        const userInfo = {
            areas: 4,
            categories: [1,],
            skills: [1,],
            use2FA: false,
        }
        let userContract

        before(async () => {
            userRecoveryAddress = contracts.recovery.address
            await contracts.userFactory.setUserRecoveryAddress(userRecoveryAddress)
            
            const recoverData = contracts.recovery.contract.recoverUser.getData(0x0, 0x0)
            await contracts.rolesLibrary.addRoleCapability(roles.moderator, userRecoveryAddress, recoverData, { from: users.contractOwner })
        })

        after(async () => {
            await reverter.revert()
        })

        describe("I want to be able to register in system", () => {
            it("and anyone should create user if all is good with OK code", async () => {
                assert.equal((await contracts.userFactory.createUserWithProxyAndRecovery.call(
                    userMainAddress,
                    userInfo.use2FA,
                    { from: users.default, }
                )).toNumber(), ErrorsScope.OK)
            })

            it("moderator should moderate user's data and create user if all is good", async () => {
                const tx = await contracts.userFactory.createUserWithProxyAndRecovery(
                    userMainAddress,
                    userInfo.use2FA,
                    { from: users.default, }
                )
                const userCreatedEvent = (await eventsHelper.findEvent([contracts.userFactory,], tx, "UserCreated"))[0]
                assert.isDefined(userCreatedEvent)

                console.log(`### created user address ${userCreatedEvent.args.user}`)

                userContract = UserInterface.at(userCreatedEvent.args.user)
            })
        })

        describe("I want to be able to restore access to the lost account", () => {

            it("user should not be able to restore by himself with UNAUTHORIZED code", async () => {
                assert.equal((await contracts.recovery.recoverUser.call(userContract.address, userNewAddress, { from: userMainAddress, })).toNumber(), ErrorsScope.UNAUTHORIZED)
            })

            it("moderator should be able to restore user with new address with OK code", async () => {
                assert.equal((await contracts.recovery.recoverUser.call(userContract.address, userNewAddress, { from: users.moderator, })).toNumber(), ErrorsScope.OK)
            })

            it("moderator should be able to restore user with new address", async () => {
                const tx = await contracts.recovery.recoverUser(userContract.address, userNewAddress, { from: users.moderator, })
                const userRecoveredEvent = (await eventsHelper.findEvent([contracts.recovery,], tx, "UserRecovered"))[0]
                assert.isDefined(userRecoveredEvent)
            })

            it("user should have new contract owner", async () => {
                assert.equal(await Owned.at(userContract.address).contractOwner.call(), userNewAddress)
            })
        })

        describe("I want to change recovery address", async () => {

            it("new address is current user", async () => {
                assert.equal(await Owned.at(userContract.address).contractOwner.call(), userNewAddress)
            })

            it("user should be able to change recovery address with OK code", async () => {
                assert.equal((await userContract.setRecoveryContract.call(users.moderator, { from: userNewAddress, })).toNumber(), ErrorsScope.OK)
            })

            it("user should be able to change recovery address", async () => {
                await userContract.setRecoveryContract(users.moderator, { from: userNewAddress, })
            })

            it("should THROW recovering with old contract with UNAUTHORIZED code", async () => {
                try {
                    await contracts.recovery.recoverUser.call(userContract.address, userNewAddress, { from: users.moderator, })
                    assert(false)
                }
                catch (e) {
                    assert(true)
                }
            })

            it("should be able to recover by the new recovery address with OK code", async () => {
                assert.equal((await userContract.recoverUser.call(userMainAddress, { from: users.moderator, })).toNumber(), ErrorsScope.OK)
            })

            it("should be able to recover by the new recovery address", async () => {
                await userContract.recoverUser(userMainAddress, { from: users.moderator, })
                assert.equal(await Owned.at(userContract.address).contractOwner.call(), userMainAddress)
            })
        })
    })

})
