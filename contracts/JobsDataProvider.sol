/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.18;


import "./base/BitOps.sol";
import "./JobDataCore.sol";


interface BoardControllerAccessor {
    function getJobsBoard(uint _jobId) external view returns (uint);
}


contract JobsDataProvider is JobDataCore {

    constructor(
        Storage _store,
        bytes32 _crate
    )
    JobDataCore(_store, _crate)
    public
    {
        require(OK == JobDataCore._init());
    }

    /// @notice Gets filtered list of jobs ids that fulfill provided parameters
    /// in a paginated way.
    function getJobs(
        uint _jobState,
        uint _skillsArea,
        uint _skillsCategory,
        uint _skills,
        uint _paused,
        uint _fromId,
        uint _maxLen
    )
    public
    view
    returns (uint[] _ids)
    {
        _ids = new uint[](_maxLen);
        uint _pointer;
        for (uint _jobId = _fromId; _jobId < _fromId + _maxLen; ++_jobId) {
            if (_filterJob(_jobId, _jobState, _skillsArea, _skillsCategory, _skills, _paused)) {
                _ids[_pointer] = _jobId;
                _pointer += 1;
            }
        }
    }

    function getJobForClientCount(address _client) public view returns (uint) {
        return store.count(clientJobs, bytes32(_client));
    }

    /// @notice Gets filtered jobs ids for a client where jobs have provided properties
    /// (job state, skills area, skills category, skills, paused)
    function getJobsForClient(
        address _client,
        uint _jobState,
        uint _skillsArea,
        uint _skillsCategory,
        uint _skills,
        uint _paused,
        uint _fromIdx,
        uint _maxLen
    )
    public
    view
    returns (uint[] _ids)
    {
        uint _count = getJobForClientCount(_client);
        require(_fromIdx < _count);
        _maxLen = (_fromIdx + _maxLen <= _count) ? _maxLen : (_count - _fromIdx);
        _ids = new uint[](_maxLen);
        uint _pointer;
        for (uint _idx = _fromIdx; _idx < _fromIdx + _maxLen; ++_idx) {
            uint _jobId = store.get(clientJobs, bytes32(_client), _idx);
            if (_filterJob(_jobId, _jobState, _skillsArea, _skillsCategory, _skills, _paused)) {
                _ids[_pointer] = _jobId;
                _pointer += 1;
            }
        }
    }

    function getJobForWorkerCount(address _worker) public view returns (uint) {
        return store.count(workerJobs, bytes32(_worker));
    }

    /// @notice Gets filtered jobs for a worker
    /// Doesn't inlcude jobs for which a worker had posted an offer but
    /// other worker got the job
    /// @param _jobState a bitmask, job's state; if INT.MAX then jobs with any state will be included in output
    /// @param _paused if job should be paused or not, convertible to bool; if greater than '1' then output includes both states
    function getJobForWorker(
        address _worker,
        uint _jobState,
        uint _skillsArea,
        uint _skillsCategory,
        uint _skills,
        uint _paused,
        uint _fromIdx,
        uint _maxLen
    )
    public
    view
    returns (uint[] _ids)
    {
        uint _count = getJobForWorkerCount(_worker);
        require(_fromIdx < _count);
        _maxLen = (_fromIdx + _maxLen <= _count) ? _maxLen : (_count - _fromIdx);
        _ids = new uint[](_maxLen);
        uint _pointer;
        for (uint _idx = _fromIdx; _idx < _fromIdx + _maxLen; ++_idx) {
            uint _jobId = store.get(workerJobs, bytes32(_worker), _idx);
            if (_filterJob(_jobId, _jobState, _skillsArea, _skillsCategory, _skills, _paused)) {
                _ids[_pointer] = _jobId;
                _pointer += 1;
            }
        }
    }

    /// @notice Gets started and not paused job id for worker
    function getFirstActiveJobForWorker(address _worker) public view returns (uint id) {
        uint _count = getJobForWorkerCount(_worker);
        for (uint _idx = 0; _idx < _count; _idx++) {
            uint _jobId = store.get(workerJobs, bytes32(_worker), _idx);
            if (_hasFlag(store.get(jobState, _jobId), JOB_STATE_STARTED) && !store.get(jobPaused, _jobId)) {
                id = _jobId;
                break;
            }
        }
    }

    function _filterJob(
        uint _jobId,
        uint _jobState,
        uint _skillsArea,
        uint _skillsCategory,
        uint _skills,
        uint _paused
    )
    private
    view
    returns (bool)
    {
        return _hasFlag(store.get(jobState, _jobId), _jobState) &&
            (_paused > 1 ? true : (_toBool(_paused) == store.get(jobPaused, _jobId))) &&
            _hasFlag(store.get(jobSkillsArea, _jobId), _skillsArea) &&
            _hasFlag(store.get(jobSkillsCategory, _jobId), _skillsCategory) &&
            _hasFlag(store.get(jobSkills, _jobId), _skills);
    }

    function _toBool(uint _value) private pure returns (bool) {
        return _value == 1 ? true : false;
    }

    function getJobsCount() public view returns (uint) {
        return store.get(jobsCount);
    }

    uint8 constant JOBS_RESULT_OFFSET = 22;

    /// @notice Gets jobs details in an archived way (too little stack size
    /// for such amount of return values)
    /// @return {
    ///     "_gotIds": "`uint` identifier",
    ///     "_boardId": "`uint` board identifier where job was pinned, '0' if no such board",
    ///     "_client": "client's address",
    ///     "_worker": "worker's address",
    ///     "_skillsArea": "`uint` skills area mask",
    ///     "_skillsCategory": "`uint` skills category mask",
    ///     "_skills": "`uint` skills mask",
    ///     "_detailsIpfs": "`bytes32` details hash",
    ///     "_state": "`uint` job's state, see JobState",
    ///     "_flowType": "`uint` job's workflow type, see WorkflowType enum",
    ///     "_paused": "`bool` paused or not, '1' - paused, '0' - running",
    ///     "_defaultPay": "`uint` job's default pay size for job seekers",
    ///     "_createdAt": "`uint` publishing (creation) timestamp",
    ///     "_acceptedAt": "`uint` an offer has been accepted timestamp",
    ///     "_pendingStartAt": "`uint` pending started timestamp",
    ///     "_startedAt": "`uint` work started timestamp",
    ///     "_pausedAt": "`uint` work's pause timestamp",
    ///     "_pausedFor": "`uint` work's pause duration",
    ///     "_pendingFinishAt": "`uint` pending finish timestamp",
    ///     "_finishedAt": "`uint` work finished timestamp",
    ///     "_finalizedAt": "`uint` paycheck finalized timestamp",
    ///     "_timeRequested": "`uint` additional time requested by a worker, must be accepted/rejected by a client",
    /// }
    function getJobsByIds(uint[] _jobIds) public view returns (
        bytes32[] _results
    ) {
        BoardControllerAccessor _boardController = BoardControllerAccessor(store.get(boardController));
        _results = new bytes32[](_jobIds.length * JOBS_RESULT_OFFSET);
        for (uint _idx = 0; _idx < _jobIds.length; ++_idx) {
            _results[_idx * JOBS_RESULT_OFFSET + 0] = bytes32(_jobIds[_idx]);
            _results[_idx * JOBS_RESULT_OFFSET + 2] = bytes32(store.get(jobClient, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 3] = bytes32(store.get(jobWorker, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 4] = bytes32(store.get(jobSkillsArea, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 5] = bytes32(store.get(jobSkillsCategory, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 6] = bytes32(store.get(jobSkills, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 7] = store.get(jobDetailsIPFSHash, _jobIds[_idx]);
            _results[_idx * JOBS_RESULT_OFFSET + 8] = bytes32(store.get(jobState, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 9] = bytes32(store.get(jobWorkflowType, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 10] = bytes32(store.get(jobPaused, _jobIds[_idx]) ? 1 : 0);
            _results[_idx * JOBS_RESULT_OFFSET + 11] = bytes32(store.get(jobDefaultPay, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 12] = bytes32(store.get(jobCreatedAt, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 13] = bytes32(store.get(jobAcceptedAt, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 14] = bytes32(store.get(jobPendingStartAt, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 15] = bytes32(store.get(jobStartTime, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 16] = bytes32(store.get(jobPausedAt, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 17] = bytes32(store.get(jobPausedFor, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 18] = bytes32(store.get(jobPendingFinishAt, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 19] = bytes32(store.get(jobFinishTime, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 20] = bytes32(store.get(jobFinalizedAt, _jobIds[_idx]));
            _results[_idx * JOBS_RESULT_OFFSET + 21] = bytes32(store.get(jobRequestedAdditionalTime, _jobIds[_idx]));

            if (address(_boardController) != 0x0) {
                _results[_idx * JOBS_RESULT_OFFSET + 1] = bytes32(_boardController.getJobsBoard(_jobIds[_idx]));
            }
        }
    }

    function getJobOffersCount(uint _jobId) public view returns (uint) {
        return store.count(jobOffers, bytes32(_jobId));
    }

    function getJobOffers(uint _jobId, uint _fromIdx, uint _maxLen) public view returns (
        uint _id,
        address[] _workers,
        uint[] _rates,
        uint[] _estimates,
        uint[] _onTops,
        uint[] _offerPostedAt
    ) {
        uint _offersCount = getJobOffersCount(_jobId);
        if (_fromIdx > _offersCount) {
            return;
        }

        _maxLen = (_fromIdx + _maxLen <= _offersCount) ? _maxLen : (_offersCount - _fromIdx);

        _id = _jobId;
        _workers = new address[](_maxLen);
        _rates = new uint[](_maxLen);
        _estimates = new uint[](_maxLen);
        _onTops = new uint[](_maxLen);
        _offerPostedAt = new uint[](_maxLen);
        uint _pointer = 0;

        for (uint _offerIdx = _fromIdx; _offerIdx < _fromIdx + _maxLen; ++_offerIdx) {
            _workers[_pointer] = store.get(jobOffers, bytes32(_jobId), _offerIdx);
            _rates[_pointer] = store.get(jobOfferRate, _jobId, _workers[_pointer]);
            _estimates[_pointer] = store.get(jobOfferEstimate, _jobId, _workers[_pointer]);
            _onTops[_pointer] = store.get(jobOfferOntop, _jobId, _workers[_pointer]);
            _offerPostedAt[_pointer] = store.get(jobOfferPostedAt, _jobId, _workers[_pointer]);
            _pointer += 1;
        }
    }

    function getJobClient(uint _jobId) public view returns (address) {
        return store.get(jobClient, _jobId);
    }

    function getJobWorker(uint _jobId) public view returns (address) {
        return store.get(jobWorker, _jobId);
    }

    function isActivatedState(uint _jobId, uint _jobState) public view returns (bool) {
        uint _flow = store.get(jobWorkflowType, _jobId);
        bool _needsConfirmation = (_flow & WORKFLOW_CONFIRMATION_NEEDED_FLAG) != 0;
        if (_needsConfirmation &&
        _jobState >= JOB_STATE_STARTED
        ) {
            return true;
        }

        if (!_needsConfirmation &&
            _jobState >= JOB_STATE_PENDING_START
        ) {
            return true;
        }
    }

    function getJobSkillsArea(uint _jobId) public view returns (uint) {
        return store.get(jobSkillsArea, _jobId);
    }

    function getJobSkillsCategory(uint _jobId) public view returns (uint) {
        return store.get(jobSkillsCategory, _jobId);
    }

    function getJobSkills(uint _jobId) public view returns (uint) {
        return store.get(jobSkills, _jobId);
    }

    function getJobDetailsIPFSHash(uint _jobId) public view returns (bytes32) {
        return store.get(jobDetailsIPFSHash, _jobId);
    }

    function getJobDefaultPay(uint _jobId) public view returns (uint) {
        return uint(store.get(jobDefaultPay, _jobId));
    }

    function getJobState(uint _jobId) public view returns (uint) {
        return uint(store.get(jobState, _jobId));
    }

    function getFinalState(uint _jobId) public view returns (uint) {
        return store.get(jobFinalizedAt, _jobId);
    }

    function calculateLock(address worker, uint _jobId, uint _time, uint _onTop) public view returns (uint) {
        // Lock additional working hour + 10% of resulting amount
        uint rate = store.get(jobOfferRate, _jobId, worker);
        return ((rate / 60 * _time + _onTop) * 11) / 10;
    }

    function calculateLockAmount(uint _jobId) public view returns (uint) {
        address worker = store.get(jobWorker, _jobId);
        // Lock additional working hour + 10% of resulting amount
        return calculateLockAmountFor(worker, _jobId);
    }

    function calculateLockAmountFor(address worker, uint _jobId) public view returns (uint) {
        uint _flow = store.get(jobWorkflowType, _jobId);
        if (_hasFlag(_flow, WORKFLOW_TM)) {
            uint onTop = store.get(jobOfferOntop, _jobId, worker);
            return calculateLock(worker, _jobId, store.get(jobOfferEstimate, _jobId, worker) + 60, onTop);
        } else if (_hasFlag(_flow, WORKFLOW_FIXED_PRICE)) {
            return store.get(jobOfferRate, _jobId, worker);
        }

        assert(false); // NOTE: need to update; other types of workflow is not supported right now
    }

    function calculatePaycheck(uint _jobId) public view returns (uint) {
        uint _flow = store.get(jobWorkflowType, _jobId);

        if (_hasFlag(_flow, WORKFLOW_TM)) {
            return _calculatePaycheckForTM(_jobId);
        } else if (_hasFlag(_flow, WORKFLOW_FIXED_PRICE)) {
            return _calculatePaycheckForFixedPrice(_jobId);
        }

        assert(false); /// NOTE: need to update; other types of workflow is not supported right now
    }

    function _calculatePaycheckForTM(uint _jobId) private view returns (uint) {
        address worker = store.get(jobWorker, _jobId);
        uint _jobState = getJobState(_jobId);
        uint _flow = store.get(jobWorkflowType, _jobId);
        bool _needsConfirmation = (_flow & WORKFLOW_CONFIRMATION_NEEDED_FLAG) != 0;
        if (_isFinishedStateForFlow(_flow, _jobState)) {
            // Means that participants have agreed on job completion,
            // reward should be calculated depending on worker's time spent.
            uint maxEstimatedTime = store.get(jobOfferEstimate, _jobId, worker) + 60;
            uint timeSpent = ((_needsConfirmation ? store.get(jobFinishTime, _jobId) : store.get(jobPendingFinishAt, _jobId)) -
                            (_needsConfirmation ? store.get(jobStartTime, _jobId) : store.get(jobPendingStartAt, _jobId)) -
                            store.get(jobPausedFor, _jobId)) / 60;
            if (timeSpent > 60 && timeSpent <= maxEstimatedTime) {
                // Worker was doing the job for more than an hour, but less then
                // maximum estimated working time. Release money for the time
                // he has actually worked + "on top" expenses.
                return timeSpent * store.get(jobOfferRate, _jobId, worker) / 60 +
                       store.get(jobOfferOntop, _jobId, worker);

            } else if (timeSpent > maxEstimatedTime) {
                // Means worker has gone over maximum estimated time and hasnt't
                // requested more time, which is his personal responsibility, since
                // we're already giving workers additional working hour from start.
                // So we release money for maximum estimated working time + "on top".
                return maxEstimatedTime * store.get(jobOfferRate, _jobId, worker) / 60 +
                       store.get(jobOfferOntop, _jobId, worker);

            } else {
                // Worker has completed the job within just an hour, so we
                // release full amount of money + "on top".
                return (maxEstimatedTime - 60) * store.get(jobOfferRate, _jobId, worker) / 60 +
                       store.get(jobOfferOntop, _jobId, worker);
            }
        } else if (
            _jobState == JOB_STATE_STARTED ||
            (!_needsConfirmation && _jobState == JOB_STATE_PENDING_START) ||
            (_needsConfirmation && _jobState == JOB_STATE_PENDING_FINISH)
        ) {
            // Job has been canceled right after start or right before completion,
            // minimum of 1 working hour + "on top" should be released.
            return store.get(jobOfferOntop, _jobId, worker) +
                   store.get(jobOfferRate, _jobId, worker);
        } else if (
            _jobState == JOB_STATE_OFFER_ACCEPTED ||
            (_needsConfirmation && _jobState == JOB_STATE_PENDING_START)
        ) {
            // Job hasn't even started yet, but has been accepted,
            // release just worker "on top" expenses.
            return store.get(jobOfferOntop, _jobId, worker);
        }
    }

    function _calculatePaycheckForFixedPrice(uint _jobId) private view returns (uint) {
        address worker = store.get(jobWorker, _jobId);
        uint _jobState = getJobState(_jobId);

        if (_jobState == JOB_STATE_WORK_ACCEPTED) {
            return store.get(jobOfferRate, _jobId, worker);
        }
    }

    function isValidEstimate(uint _rate, uint _estimate, uint _ontop) public pure returns (bool) {
        if (_rate == 0 || _estimate == 0) {
            return false;
        }
        uint prev = 0;
        for (uint i = 1; i <= _estimate + 60; i++) {
            uint curr = prev + _rate;
            if (curr < prev) {
                return false;
            }
            prev = curr;
        }
        return ((prev + _ontop) / 10) * 11 > prev;
    }
}
