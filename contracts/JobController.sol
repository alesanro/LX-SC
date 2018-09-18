/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-storage-lib/contracts/StorageAdapter.sol";
import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";
import "./base/BitOps.sol";
import "./JobDataCore.sol";
import "./JobsDataProvider.sol";


contract UserLibraryInterface {
    function hasSkills(address _user, uint _area, uint _category, uint _skills) public view returns (bool);
}


contract PaymentProcessorInterface {
    function lockPayment(bytes32 _operationId, address _from) public payable returns (uint);
    function releasePayment(
        bytes32 _operationId, 
        address _to, 
        uint _value, 
        address _change, 
        uint _feeFromValue, 
        uint _additionalFee
        ) 
        public 
        returns (uint);
}


contract JobController is JobDataCore, MultiEventsHistoryAdapter, Roles2LibraryAdapter {

    uint constant JOB_CONTROLLER_SCOPE = 13000;
    uint constant JOB_CONTROLLER_INVALID_ESTIMATE = JOB_CONTROLLER_SCOPE + 1;
    uint constant JOB_CONTROLLER_INVALID_SKILLS = JOB_CONTROLLER_SCOPE + 2;
    uint constant JOB_CONTROLLER_INVALID_STATE = JOB_CONTROLLER_SCOPE + 3;
    uint constant JOB_CONTROLLER_WORKER_RATE_NOT_SET = JOB_CONTROLLER_SCOPE + 4;
    uint constant JOB_CONTROLLER_WORK_IS_ALREADY_PAUSED = JOB_CONTROLLER_SCOPE + 5;
    uint constant JOB_CONTROLLER_WORK_IS_NOT_PAUSED = JOB_CONTROLLER_SCOPE + 6;
    uint constant JOB_CONTROLLER_INVALID_WORKFLOW_TYPE = JOB_CONTROLLER_SCOPE + 7;
    uint constant JOB_CONTROLLER_INVALID_ROLE = JOB_CONTROLLER_SCOPE + 8;
    uint constant JOB_CONTROLLER_NO_TIME_REQUEST_SUBMITTED = JOB_CONTROLLER_SCOPE + 9;
    uint constant JOB_CONTROLLER_INCORRECT_TIME_PROVIDED = JOB_CONTROLLER_SCOPE + 10;
    uint constant JOB_CONTROLLER_INVALID_WORKER_PAYCHECK_VALUE = JOB_CONTROLLER_SCOPE + 11;


    event JobPosted(address indexed self, uint indexed jobId, bytes32 flowType, address client, uint skillsArea, uint skillsCategory, uint skills, uint defaultPay, bytes32 detailsIPFSHash, bool bindStatus);
    event JobOfferPosted(address indexed self, uint indexed jobId, address worker, uint rate, uint estimate, uint ontop);
    event JobOfferPosted(address indexed self, uint indexed jobId, address worker, uint price);
    event JobOfferAccepted(address indexed self, uint indexed jobId, address worker);
    event StartWorkRequested(address indexed self, uint indexed jobId, uint at);
    event WorkStarted(address indexed self, uint indexed jobId, uint at);
    event TimeRequestSubmitted(address indexed self, uint indexed jobId, uint time);  // Additional `time` in minutes
    event TimeRequestAccepted(address indexed self, uint indexed jobId, uint time);
    event TimeRequestRejected(address indexed self, uint indexed jobId, uint time);
    event WorkPaused(address indexed self, uint indexed jobId, uint at);
    event WorkResumed(address indexed self, uint indexed jobId, uint at);
    event EndWorkRequested(address indexed self, uint indexed jobId, uint at);
    event WorkAccepted(address indexed self, uint indexed jobId, uint at);
    event WorkRejected(address indexed self, uint indexed jobId, uint at);
    event WorkDisputeResolved(address indexed self, uint indexed jobId, uint at);
    event PaymentReleased(address indexed self, uint indexed jobId);
    event JobCanceled(address indexed self, uint indexed jobId);

    PaymentProcessorInterface public paymentProcessor;
    UserLibraryInterface public userLibrary;
    JobsDataProvider public jobsDataProvider;

    modifier onlyClient(uint _jobId) {
        if (store.get(jobClient, _jobId) != msg.sender) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_ROLE);
            assembly {
                mstore(0, 13008) // JOB_CONTROLLER_INVALID_ROLE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyWorker(uint _jobId) {
        if (store.get(jobWorker, _jobId) != msg.sender) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_ROLE);
            assembly {
                mstore(0, 13008) // JOB_CONTROLLER_INVALID_ROLE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyNotClient(uint _jobId) {
        if (store.get(jobClient, _jobId) == msg.sender) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_ROLE);
            assembly {
                mstore(0, 13008) // JOB_CONTROLLER_INVALID_ROLE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyJobState(uint _jobId, uint _jobState) {
        if (store.get(jobState, _jobId) != _jobState) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_STATE);
            assembly {
                mstore(0, 13003) // JOB_CONTROLLER_INVALID_STATE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyValidWorkflow(uint _flowType) {
        if (!_isValidFlow(_flowType)) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_WORKFLOW_TYPE);
            assembly {
                mstore(0, 13007) // JOB_CONTROLLER_INVALID_WORKFLOW_TYPE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyFlow(uint _jobId, uint _flowTypeGroup) {
        _flowTypeGroup = _flowTypeGroup & ~WORKFLOW_FEATURE_FLAGS;
        if (!_hasFlag(store.get(jobWorkflowType, _jobId), _flowTypeGroup)) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_WORKFLOW_TYPE);
            assembly {
                mstore(0, 13007) // JOB_CONTROLLER_INVALID_WORKFLOW_TYPE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyStartedState(uint _jobId) {
        uint _flow = store.get(jobWorkflowType, _jobId);
        uint _jobState = store.get(jobState, _jobId);
        if (!_isStartedStateForFlow(_flow, _jobState)) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_STATE);
            assembly {
                mstore(0, 13003) // JOB_CONTROLLER_INVALID_STATE
                return(0, 32)
            }
        }

        _;
    }

    modifier onlyFinishedState(uint _jobId) {
        uint _flow = store.get(jobWorkflowType, _jobId);
        uint _jobState = store.get(jobState, _jobId);
        if (!_isFinishedStateForFlow(_flow, _jobState)) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_STATE);
            assembly {
                mstore(0, 13003) // JOB_CONTROLLER_INVALID_STATE
                return(0, 32)
            }
        }
        _;
    }

    modifier onlyWithSubmittedRequest(uint _jobId) {
        if (store.get(jobRequestedAdditionalTime, _jobId) == 0) {
            _emitErrorCode(JOB_CONTROLLER_NO_TIME_REQUEST_SUBMITTED);
            assembly {
                mstore(0, 13009) // JOB_CONTROLLER_NO_TIME_REQUEST_SUBMITTED
                return(0, 32)
            }
        }
        _;
    }

    constructor(
        Storage _store,
        bytes32 _crate,
        address _roles2Library
    )
    JobDataCore(_store, _crate)
    Roles2LibraryAdapter(_roles2Library)
    public
    {
    }

    function init() auth external returns (uint) {
        return JobDataCore._init();
    }

    function setupEventsHistory(address _eventsHistory) auth external returns (uint) {
        require(_eventsHistory != 0x0);

        _setEventsHistory(_eventsHistory);
        return OK;
    }

    /// @notice Sets contract address that satisfies BoardControllerAccessor interface
    function setBoardController(address _boardController) auth external returns (uint) {
        store.set(boardController, _boardController);
        return OK;
    }

    function setPaymentProcessor(PaymentProcessorInterface _paymentProcessor) auth external returns (uint) {
        paymentProcessor = _paymentProcessor;
        return OK;
    }

    function setUserLibrary(UserLibraryInterface _userLibrary) auth external returns (uint) {
        userLibrary = _userLibrary;
        return OK;
    }

    function setJobsDataProvider(JobsDataProvider _jobsDataProvider) auth external returns (uint) {
        jobsDataProvider = _jobsDataProvider;
        return OK;
    }

    /// @notice Creates and posts a new job to a job marketplace
    /// @param _flowType see WorkflowType
    function postJob(
        uint _flowType,
        uint _area,
        uint _category,
        uint _skills,
        uint _defaultPay,
        bytes32 _detailsIPFSHash
    )
    onlyValidWorkflow(_flowType)
    singleOddFlag(_area)
    singleOddFlag(_category)
    hasFlags(_skills)
    public
    returns (uint)
    {
        uint jobId = store.get(jobsCount) + 1;
        store.set(bindStatus, jobId, false);
        store.set(jobsCount, jobId);
        store.set(jobCreatedAt, jobId, now);
        store.set(jobState, jobId, JOB_STATE_CREATED);
        store.set(jobWorkflowType, jobId, _flowType);
        store.set(jobClient, jobId, msg.sender);
        store.set(jobSkillsArea, jobId, _area);
        store.set(jobSkillsCategory, jobId, _category);
        store.set(jobSkills, jobId, _skills);
        store.set(jobDefaultPay, jobId, _defaultPay);
        store.set(jobDetailsIPFSHash, jobId, _detailsIPFSHash);
        store.add(clientJobs, bytes32(msg.sender), jobId);

        _emitter().emitJobPosted(jobId, _flowType, msg.sender, _area, _category, _skills, _defaultPay, _detailsIPFSHash, false);
        return OK;
    }

    function postJobOffer(
        uint _jobId,
        uint _rate,
        uint _estimate,
        uint _ontop
    )
    onlyNotClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyJobState(_jobId, JOB_STATE_CREATED)
    public
    returns (uint)
    {
        if (!jobsDataProvider._isValidEstimate(_rate, _estimate, _ontop)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_ESTIMATE);
        }

        if (!_hasSkillsCheck(_jobId)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_SKILLS);
        }

        store.set(jobOfferRate, _jobId, msg.sender, _rate);
        store.set(jobOfferEstimate, _jobId, msg.sender, _estimate);
        store.set(jobOfferOntop, _jobId, msg.sender, _ontop);
        _addJobOffer(_jobId);

        _emitter().emitJobOfferPosted(_jobId, msg.sender, _rate, _estimate, _ontop);
        return OK;
    }

    function postJobOfferWithPrice(
        uint _jobId,
        uint _price
    )
    onlyNotClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_FIXED_PRICE)
    onlyJobState(_jobId, JOB_STATE_CREATED)
    external
    returns (uint) {
        require(_price > 0);

        if (!_hasSkillsCheck(_jobId)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_SKILLS);
        }

        store.set(jobOfferRate, _jobId, msg.sender, _price);
        _addJobOffer(_jobId);

        _emitter().emitJobOfferPosted(_jobId, msg.sender, _price);

        return OK;
    }

    function _hasSkillsCheck(uint _jobId) internal view returns (bool) {
        return userLibrary.hasSkills(
            msg.sender,
            store.get(jobSkillsArea, _jobId),
            store.get(jobSkillsCategory, _jobId),
            store.get(jobSkills, _jobId)
        );
    }

    function _addJobOffer(uint _jobId) private {
        store.add(workerJobs, bytes32(msg.sender), _jobId);
        store.add(jobOffers, bytes32(_jobId), msg.sender);
        store.set(jobOfferPostedAt, _jobId, msg.sender, now);
    }

    function acceptOffer(
        uint _jobId,
        address _worker
    )
    onlyClient(_jobId)
    onlyJobState(_jobId, JOB_STATE_CREATED)
    external
    payable
    returns (uint _resultCode)
    {
        if (store.get(jobOfferRate, _jobId, _worker) == 0) {
            return _emitErrorCode(JOB_CONTROLLER_WORKER_RATE_NOT_SET);
        }

        // Maybe incentivize by locking some money from worker?
        store.set(jobWorker, _jobId, _worker);

        require(msg.value == jobsDataProvider.calculateLockAmount(_jobId));

        _resultCode = paymentProcessor.lockPayment.value(msg.value)(bytes32(_jobId), msg.sender);
        if (_resultCode != OK) {
            revert();
        }

        store.set(jobAcceptedAt, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_OFFER_ACCEPTED);
        _cleanupJobOffers(_jobId, _worker);

        _emitter().emitJobOfferAccepted(_jobId, _worker);
        return OK;
    }

    function _cleanupJobOffers(uint _jobId, address _acceptedOffer) private {
        uint _offersCount = store.count(jobOffers, bytes32(_jobId));
        for (uint _offerIdx = 0; _offerIdx < _offersCount; ++_offerIdx) {
            address _offer = store.get(jobOffers, bytes32(_jobId), _offerIdx);
            if (_offer != _acceptedOffer) {
                store.remove(workerJobs, bytes32(_offer), _jobId);
            }
        }
    }

    function startWork(
        uint _jobId
    )
    onlyWorker(_jobId)
    onlyJobState(_jobId, JOB_STATE_OFFER_ACCEPTED)
    external
    returns (uint)
    {
        store.set(jobPendingStartAt, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_PENDING_START);

        _emitter().emitStartWorkRequested(_jobId, now);
        return OK;
    }

    function confirmStartWork(
        uint _jobId
    )
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyJobState(_jobId, JOB_STATE_PENDING_START)
    external
    returns (uint)
    {
        store.set(jobState, _jobId, JOB_STATE_STARTED);
        store.set(jobStartTime, _jobId, now);

        _emitter().emitWorkStarted(_jobId, now);
        return OK;
    }

    function pauseWork(
        uint _jobId
    )
    onlyWorker(_jobId)
    onlyStartedState(_jobId)
    external
    returns (uint)
    {
        if (store.get(jobPaused, _jobId)) {
            return _emitErrorCode(JOB_CONTROLLER_WORK_IS_ALREADY_PAUSED);
        }

        store.set(jobPaused, _jobId, true);
        store.set(jobPausedAt, _jobId, now);

        _emitter().emitWorkPaused(_jobId, now);
        return OK;
    }

    function resumeWork(
        uint _jobId
    )
    onlyWorker(_jobId)
    onlyStartedState(_jobId)
    external
    returns (uint _resultCode)
    {
        _resultCode = _resumeWork(_jobId);
        if (_resultCode != OK) {
            return _emitErrorCode(_resultCode);
        }
    }

    function _resumeWork(uint _jobId) internal returns (uint) {
        if (!store.get(jobPaused, _jobId)) {
            return JOB_CONTROLLER_WORK_IS_NOT_PAUSED;
        }
        store.set(jobPaused, _jobId, false);
        store.set(jobPausedFor, _jobId, store.get(jobPausedFor, _jobId) + (now - store.get(jobPausedAt, _jobId)));

        _emitter().emitWorkResumed(_jobId, now);
        return OK;
    }

    function submitAdditionalTimeRequest(
        uint _jobId,
        uint16 _additionalTime
    )
    onlyWorker(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyStartedState(_jobId)
    external
    returns (uint)
    {
        require(_additionalTime != 0);

        store.set(jobRequestedAdditionalTime, _jobId, uint(_additionalTime));

        _emitter().emitTimeRequestSubmitted(_jobId, _additionalTime);
        return OK;
    }

    function acceptAdditionalTimeRequest(
        uint _jobId,
        uint16 _additionalTime
    )
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyStartedState(_jobId)
    onlyWithSubmittedRequest(_jobId)
    external
    payable
    returns (uint)
    {
        // ensure that no raised condition were met and client knows exactly how much time is actually requested
        uint16 _storedAdditionalTime = uint16(store.get(jobRequestedAdditionalTime, _jobId));
        if (_storedAdditionalTime != _additionalTime) {
            return _emitErrorCode(JOB_CONTROLLER_INCORRECT_TIME_PROVIDED);
        }

        if (!_setNewEstimate(_jobId, _additionalTime)) {
            revert();
        }

        store.set(jobRequestedAdditionalTime, _jobId, 0);

        _emitter().emitTimeRequestAccepted(_jobId, _additionalTime);
        return OK;
    }

    function rejectAdditionalTimeRequest(
        uint _jobId
    )
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyStartedState(_jobId)
    onlyWithSubmittedRequest(_jobId)
    external
    returns (uint)
    {
        uint _additionalTime = store.get(jobRequestedAdditionalTime, _jobId);
        store.set(jobRequestedAdditionalTime, _jobId, 0);

        _emitter().emitTimeRequestRejected(_jobId, _additionalTime);
        return OK;
    }

    function _setNewEstimate(uint _jobId, uint16 _additionalTime)
    internal
    returns (bool)
    {
        uint jobPaymentLocked = jobsDataProvider.calculateLockAmount(_jobId);
        store.set(
            jobOfferEstimate,
            _jobId,
            store.get(jobWorker, _jobId),
            store.get(jobOfferEstimate, _jobId, store.get(jobWorker, _jobId)) + _additionalTime
        );

        require(
            jobsDataProvider.calculateLockAmount(_jobId) - jobPaymentLocked == msg.value, 
            "JOB_CONTROLLER_INVALID_TIME_REQUEST_PAYMENT_VALUE"
        );

        return OK == paymentProcessor.lockPayment.value(msg.value)(bytes32(_jobId), msg.sender);
    }

    function endWork(
        uint _jobId
    )
    onlyWorker(_jobId)
    onlyStartedState(_jobId)
    external
    returns (uint)
    {
        _resumeWork(_jobId);  // In case worker have forgotten about paused timer
        store.set(jobPendingFinishAt, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_PENDING_FINISH);

        _emitter().emitEndWorkRequested(_jobId, now);
        return OK;
    }

    function cancelJob(
        uint _jobId
    )
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    external
    returns (uint _resultCode)
    {
        uint _jobState = _getJobState(_jobId);
        uint _flow = store.get(jobWorkflowType, _jobId);

        if (!_isActiveStateForFlow(_flow, _jobState)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_STATE);
        }

        uint payCheck = jobsDataProvider.calculatePaycheck(_jobId);
        address worker = store.get(jobWorker, _jobId);

        _resultCode = paymentProcessor.releasePayment(
            bytes32(_jobId),
            worker,
            payCheck,
            store.get(jobClient, _jobId),
            payCheck,
            0
        );
        if (_resultCode != OK) {
            return _emitErrorCode(_resultCode);
        }

        store.set(jobFinalizedAt, _jobId, _getJobState(_jobId));
        store.set(jobState, _jobId, JOB_STATE_FINALIZED);

        _emitter().emitJobCanceled(_jobId);
        return OK;
    }

    function acceptWorkResults(uint _jobId)
    external
    onlyClient(_jobId)
    onlyJobState(_jobId, JOB_STATE_PENDING_FINISH)
    returns (uint) 
    {
        store.set(jobFinishTime, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_WORK_ACCEPTED);

        _emitter().emitWorkAccepted(_jobId, now);
        return OK;
    }

    function rejectWorkResults(uint _jobId)
    external
    onlyClient(_jobId)
    onlyJobState(_jobId, JOB_STATE_PENDING_FINISH)
    returns (uint _resultCode) 
    {
        store.set(jobFinishTime, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_WORK_REJECTED);

        _emitter().emitWorkRejected(_jobId, now);
        return OK;
    }

    function resolveWorkDispute(
        uint _jobId,
        uint _workerPaycheck,
        uint _penaltyFee
    )
    external
    auth
    onlyJobState(_jobId, JOB_STATE_WORK_REJECTED)
    returns (uint _resultCode) {
        uint payCheck = jobsDataProvider.calculateLockAmount(_jobId);
        if (payCheck < _workerPaycheck) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_WORKER_PAYCHECK_VALUE);
        }

        address worker = store.get(jobWorker, _jobId);
        address client = store.get(jobClient, _jobId);
        if (_workerPaycheck > 0) {
            _resultCode = paymentProcessor.releasePayment(
                bytes32(_jobId),
                worker,
                _workerPaycheck,
                client,
                0,
                _penaltyFee
            );
            if (_resultCode != OK) {
                return _emitErrorCode(_resultCode);
            }
        } else {
            _resultCode = paymentProcessor.releasePayment(
                bytes32(_jobId),
                client,
                payCheck,
                client,
                0,
                _penaltyFee
            );
            if (_resultCode != OK) {
                return _emitErrorCode(_resultCode);
            }
        }

        store.set(jobFinalizedAt, _jobId, _getJobState(_jobId));
        store.set(jobState, _jobId, JOB_STATE_FINALIZED);

        _emitter().emitWorkDistputeResolved(_jobId, now);
        return OK;
    }

    function releasePayment(
        uint _jobId
    )
    onlyFinishedState(_jobId)
    public
    returns (uint _resultCode)
    {
        uint payCheck = jobsDataProvider.calculatePaycheck(_jobId);
        address worker = store.get(jobWorker, _jobId);

        _resultCode = paymentProcessor.releasePayment(
            bytes32(_jobId),
            worker,
            payCheck,
            store.get(jobClient, _jobId),
            payCheck,
            0
        );
        if (_resultCode != OK) {
            return _emitErrorCode(_resultCode);
        }

        store.set(jobFinalizedAt, _jobId, _getJobState(_jobId));
        store.set(jobState, _jobId, JOB_STATE_FINALIZED);

        _emitter().emitPaymentReleased(_jobId);
        return OK;
    }

    function emitJobPosted(
        uint _jobId,
        uint _flowType,
        address _client,
        uint _skillsArea,
        uint _skillsCategory,
        uint _skills,
        uint _defaultPay,
        bytes32 _detailsIPFSHash,
        bool _bindStatus
    )
    public
    {
        emit JobPosted(_self(), _jobId, bytes32(_flowType), _client, _skillsArea, _skillsCategory, _skills, _defaultPay, _detailsIPFSHash, _bindStatus);
    }

    function emitJobOfferPosted(uint _jobId, address _worker, uint _rate, uint _estimate, uint _ontop) public {
        emit JobOfferPosted(_self(), _jobId, _worker, _rate, _estimate, _ontop);
    }

    function emitJobOfferPosted(uint _jobId, address _worker, uint _price) public {
        emit JobOfferPosted(_self(), _jobId, _worker, _price);
    }

    function emitJobOfferAccepted(uint _jobId, address _worker) public {
        emit JobOfferAccepted(_self(), _jobId, _worker);
    }

    function emitStartWorkRequested(uint _jobId, uint _at) public {
        emit StartWorkRequested(_self(), _jobId, _at);
    }

    function emitWorkStarted(uint _jobId, uint _at) public {
        emit WorkStarted(_self(), _jobId, _at);
    }

    function emitWorkPaused(uint _jobId, uint _at) public {
        emit WorkPaused(_self(), _jobId, _at);
    }

    function emitWorkResumed(uint _jobId, uint _at) public {
        emit WorkResumed(_self(), _jobId, _at);
    }

    function emitTimeRequestSubmitted(uint _jobId, uint _time) public {
        emit TimeRequestSubmitted(_self(), _jobId, _time);
    }

    function emitTimeRequestAccepted(uint _jobId, uint _time) public {
        emit TimeRequestAccepted(_self(), _jobId, _time);
    }

    function emitTimeRequestRejected(uint _jobId, uint _time) public {
        emit TimeRequestRejected(_self(), _jobId, _time);
    }

    function emitEndWorkRequested(uint _jobId, uint _at) public {
        emit EndWorkRequested(_self(), _jobId, _at);
    }

    function emitWorkAccepted(uint _jobId, uint _at) public {
        emit WorkAccepted(_self(), _jobId, _at);
    }

    function emitWorkRejected(uint _jobId, uint _at) public {
        emit WorkRejected(_self(), _jobId, _at);
    }

    function emitWorkDistputeResolved(uint _jobId, uint _at) public {
        emit WorkDisputeResolved(_self(), _jobId, _at);
    }

    function emitPaymentReleased(uint _jobId) public {
        emit PaymentReleased(_self(), _jobId);
    }

    function emitJobCanceled(uint _jobId) public {
        emit JobCanceled(_self(), _jobId);
    }

    function _getJobState(uint _jobId) private view returns (uint) {
        return uint(store.get(jobState, _jobId));
    }

    function _emitErrorCode(uint _errorCode) internal returns (uint) {
        if (msg.value > 0) {
            msg.sender.transfer(msg.value);
        }
        return super._emitErrorCode(_errorCode);
    }

    function _emitter() private view returns (JobController) {
        return JobController(getEventsHistory());
    }
}

