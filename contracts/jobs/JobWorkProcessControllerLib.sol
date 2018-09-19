/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./JobControllerAbstract.sol";


contract JobWorkProcessControllerLib is Roles2LibraryAdapter, JobControllerAbstract {

    constructor(
    )
    Roles2LibraryAdapter(address(this))
    JobDataCore(Storage(0x0), "")
    public
    {
    }

    function startWork(
        uint _jobId
    )
    external
    onlyWorker(_jobId)
    onlyJobState(_jobId, JOB_STATE_OFFER_ACCEPTED)
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
    external
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyJobState(_jobId, JOB_STATE_PENDING_START)
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
    external
    onlyWorker(_jobId)
    onlyStartedState(_jobId)
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
    external
    onlyWorker(_jobId)
    onlyStartedState(_jobId)
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
    external
    onlyWorker(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyStartedState(_jobId)
    returns (uint)
    {
        require(_additionalTime != 0, "JOB_CONTROLLER_TIME_REQUEST_INVALID_TIME");

        store.set(jobRequestedAdditionalTime, _jobId, uint(_additionalTime));

        _emitter().emitTimeRequestSubmitted(_jobId, _additionalTime);
        return OK;
    }

    function acceptAdditionalTimeRequest(
        uint _jobId,
        uint16 _additionalTime
    )
    external
    payable
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyStartedState(_jobId)
    onlyWithSubmittedRequest(_jobId)
    returns (uint)
    {
        // ensure that no raised condition were met and client knows exactly how much time is actually requested
        uint16 _storedAdditionalTime = uint16(store.get(jobRequestedAdditionalTime, _jobId));
        if (_storedAdditionalTime != _additionalTime) {
            return _emitErrorCode(JOB_CONTROLLER_INCORRECT_TIME_PROVIDED);
        }

        if (!_setNewEstimate(_jobId, _additionalTime)) {
            revert("JOB_CONTROLLER_CANNOT_SET_NEW_ESTIMATE");
        }

        store.set(jobRequestedAdditionalTime, _jobId, 0);

        _emitter().emitTimeRequestAccepted(_jobId, _additionalTime);
        return OK;
    }

    function rejectAdditionalTimeRequest(
        uint _jobId
    )
    external
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
    onlyStartedState(_jobId)
    onlyWithSubmittedRequest(_jobId)
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
    external
    onlyWorker(_jobId)
    onlyStartedState(_jobId)
    returns (uint)
    {
        _resumeWork(_jobId);  // In case worker have forgotten about paused timer
        store.set(jobPendingFinishAt, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_PENDING_FINISH);

        _emitter().emitEndWorkRequested(_jobId, now);
        return OK;
    }
}