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

        _emitter().emitPaymentReleased(_jobId);
        return OK;
    }

    function _getJobState(uint _jobId) private view returns (uint) {
        return uint(store.get(jobState, _jobId));
    }
}