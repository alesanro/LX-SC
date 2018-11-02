/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./JobControllerAbstract.sol";


contract JobWorkAcceptanceControllerLib is Roles2LibraryAdapter, JobControllerAbstract {

    constructor(
    )
    Roles2LibraryAdapter(address(this))
    JobDataCore(Storage(0x0), "")
    public
    {
    }

    function cancelJob(
        uint _jobId
    )
    external
    onlyClient(_jobId)
    onlyFlow(_jobId, WORKFLOW_TM)
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

        _emitter().emitJobCanceled(_jobId, worker, store.get(jobClient, _jobId));
        return OK;
    }

    function acceptWorkResults(uint _jobId)
    public
    onlyClient(_jobId)
    onlyJobStates(_jobId, JOB_STATE_PENDING_FINISH | JOB_STATE_WORK_REJECTED)
    returns (uint)
    {
        store.set(jobFinishTime, _jobId, now);
        store.set(jobState, _jobId, JOB_STATE_WORK_ACCEPTED);

        _emitter().emitWorkAccepted(_jobId, now, store.get(jobWorker, _jobId), msg.sender);
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

        _emitter().emitWorkRejected(_jobId, now, store.get(jobWorker, _jobId), msg.sender);
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
        _resultCode = _releaseSplittedPayment(_jobId, _workerPaycheck, _penaltyFee);
        if (_resultCode == OK) {
            _emitter().emitWorkDistputeResolved(_jobId, now, store.get(jobWorker, _jobId), store.get(jobClient, _jobId));
            return OK;
        } else {
            return _emitErrorCode(_resultCode);
        }
    }

    function releasePayment(
        uint _jobId
    )
    public
    onlyFinishedState(_jobId)
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

        _emitter().emitPaymentReleased(_jobId, worker, store.get(jobClient, _jobId));
        return OK;
    }

    function acceptWorkResultsAndReleasePayment(uint _jobId)
    public
    returns (uint _resultCode)
    {
        _resultCode = acceptWorkResults(_jobId);
        if (_resultCode == OK) {
            return releasePayment(_jobId);
        } else {
            return _emitErrorCode(_resultCode);
        }
    }

    function delegate(
        uint _jobId
    )
    public
    onlyClient(_jobId)
    onlyJobState(_jobId, JOB_STATE_WORK_REJECTED)
    returns (uint _resultCode)
    {
        store.set(jobState, _jobId, JOB_STATE_DELEGATED);
        _emitter().emitDelegated(_jobId, now, store.get(jobWorker, _jobId), msg.sender);
    }

    function _sendForRedo(
        uint _jobId
    )
    private
    returns (uint _resultCode)
    {
        store.set(jobState, _jobId, JOB_STATE_STARTED);
        _emitter().emitSentForRedo(_jobId, now, store.get(jobWorker, _jobId), store.get(jobClient, _jobId));
        return OK;
    }

    function sendForRedoByClient(
        uint _jobId
    )
    public
    onlyClient(_jobId)
    onlyJobState(_jobId, JOB_STATE_WORK_REJECTED)
    returns (uint _resultCode)
    {
        return _sendForRedo(_jobId);
    }

    function sendForRedoByBoardOwner(
        uint _jobId
    )
    public
    onlyBoardOwner(_jobId)
    onlyJobState(_jobId, JOB_STATE_DELEGATED)
    returns (uint _resultCode)
    {
        return _sendForRedo(_jobId);
    }

    function payDelegated(
        uint _jobId,
        uint _workerPaycheck,
        uint _penaltyFee
    )
    public
    onlyJobState(_jobId, JOB_STATE_DELEGATED)
    onlyBoardOwner(_jobId)
    returns (uint) {
        return _payDelegated(_jobId, _workerPaycheck, _penaltyFee);
    }

    function _payDelegated(
        uint _jobId,
        uint _workerPaycheck,
        uint _penaltyFee
    )
    private
    returns (uint _resultCode) {
        _resultCode = _releaseSplittedPayment(_jobId, _workerPaycheck, _penaltyFee);
        if (_resultCode == OK) {
            _emitter().emitPaidDelegated(_jobId, now, store.get(jobWorker, _jobId), store.get(jobClient, _jobId));
            return OK;
        } else {
            return _emitErrorCode(_resultCode);
        }
    }

    function _releaseSplittedPayment (
        uint _jobId,
        uint _workerPaycheck,
        uint _penaltyFee
    )
    private
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

        return OK;

    }

    function _getJobState(uint _jobId) private view returns (uint) {
        return uint(store.get(jobState, _jobId));
    }

}
