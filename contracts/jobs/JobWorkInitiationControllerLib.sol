/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./JobControllerAbstract.sol";


contract JobWorkInitiationControllerLib is Roles2LibraryAdapter, JobControllerAbstract {

    constructor(
    )
    Roles2LibraryAdapter(address(this))
    JobDataCore(Storage(0x0), "")
    public
    {
    }

    function postJobInBoard(
        uint _flowType,
        uint _area,
        uint _category,
        uint _skills,
        uint _defaultPay,
        bytes32 _detailsIPFSHash,
        uint _boardId
    )
    onlyValidBoard(_boardId)
    onlyValidWorkflow(_flowType)
    singleOddFlag(_area)
    singleOddFlag(_category)
    hasFlags(_skills)
    public
    returns (uint)
    {
        return _postJobInBoard(
            _flowType,
            _area,
            _category,
            _skills,
            _defaultPay,
            _detailsIPFSHash,
            _boardId
        );
    }

    function _postJobInBoard(
        uint _flowType,
        uint _area,
        uint _category,
        uint _skills,
        uint _defaultPay,
        bytes32 _detailsIPFSHash,
        uint _boardId
    )
    private
    returns (uint)
    {
        uint jobId = store.get(jobsCount) + 1;
        BoardControllerInterface _boardController = BoardControllerInterface(store.get(boardController));
        uint result = _boardController.bindJobWithBoard(_boardId, jobId);
        if (result != OK) {
            return _emitErrorCode(result);
        }
        store.set(bindStatus, jobId, true);
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
        _emitter().emitJobPosted(jobId, _flowType, msg.sender, _area, _category, _skills, _defaultPay, _detailsIPFSHash, true);
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
    public
    onlyValidWorkflow(_flowType)
    singleOddFlag(_area)
    singleOddFlag(_category)
    hasFlags(_skills)
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
    public
    onlyNotClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyJobState(_jobId, JOB_STATE_CREATED)
    returns (uint)
    {
        if (!jobsDataProvider.isValidEstimate(_rate, _estimate, _ontop)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_ESTIMATE);
        }

        if (!_hasSkillsCheck(_jobId)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_SKILLS);
        }

        store.set(jobOfferRate, _jobId, msg.sender, _rate);
        store.set(jobOfferEstimate, _jobId, msg.sender, _estimate);
        store.set(jobOfferOntop, _jobId, msg.sender, _ontop);
        _addJobOffer(_jobId);

        _emitter().emitJobOfferPostedTimesBased(_jobId, msg.sender, _rate, _estimate, _ontop);
        return OK;
    }

    function postJobOfferWithPrice(
        uint _jobId,
        uint _price
    )
    external
    onlyNotClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_FIXED_PRICE)
    onlyJobState(_jobId, JOB_STATE_CREATED)
    returns (uint) {
        require(_price > 0, "JOB_CONTROLLER_JOB_OFFER_INVALID_PRICE");

        if (!_hasSkillsCheck(_jobId)) {
            return _emitErrorCode(JOB_CONTROLLER_INVALID_SKILLS);
        }

        store.set(jobOfferRate, _jobId, msg.sender, _price);
        _addJobOffer(_jobId);

        _emitter().emitJobOfferPostedFixedPrice(_jobId, msg.sender, _price);

        return OK;
    }

    function _hasSkillsCheck(uint _jobId) internal view returns (bool) {
        // TODO: remove after demo
        // return userLibrary.hasSkills(
        //     msg.sender,
        //     store.get(jobSkillsArea, _jobId),
        //     store.get(jobSkillsCategory, _jobId),
        //     store.get(jobSkills, _jobId)
        // );
        return true;
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
    external
    payable
    onlyClient(_jobId)
    onlyJobState(_jobId, JOB_STATE_CREATED)
    returns (uint _resultCode)
    {
        if (store.get(jobOfferRate, _jobId, _worker) == 0) {
            return _emitErrorCode(JOB_CONTROLLER_WORKER_RATE_NOT_SET);
        }

        // Maybe incentivize by locking some money from worker?
        store.set(jobWorker, _jobId, _worker);

        require(msg.value == jobsDataProvider.calculateLockAmount(_jobId), "JOB_CONTROLLER_ACCEPT_OFFER_INVALID_VALUE");

        _resultCode = paymentProcessor.lockPayment.value(msg.value)(bytes32(_jobId), msg.sender);
        if (_resultCode != OK) {
            revert("JOB_CONTROLLER_CANNOT_LOCK_PAYMENT");
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
}
