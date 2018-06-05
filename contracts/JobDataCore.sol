/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.18;


import "./base/BitOps.sol";
import "./adapters/StorageAdapter.sol";


contract JobDataCore is StorageAdapter, BitOps {

    enum JobState { 
        NOT_SET, 
        CREATED, 
        OFFER_ACCEPTED, 
        PENDING_START, 
        STARTED, 
        PENDING_FINISH, 
        FINISHED, 
        WORK_ACCEPTED, 
        WORK_REJECTED, 
        FINALIZED
    }

    uint constant OK = 1;

    /// Defines a set of masks that define different groups of workflows
    uint constant WORKFLOW_TM = 1;
    uint constant WORKFLOW_FIXED_PRICE = 2;

    uint constant WORKFLOW_MAX = WORKFLOW_FIXED_PRICE;

    uint constant WORKFLOW_TM_FEATURES_ALLOWED = WORKFLOW_CONFIRMATION_NEEDED_FLAG;
    uint constant WORKFLOW_FIXED_PRICE_FEATURES_ALLOWED = 0;

    uint constant WORKFLOW_CONFIRMATION_ALLOWED = WORKFLOW_TM;

    uint constant WORKFLOW_CONFIRMATION_NEEDED_FLAG = 0x8000000000000000000000000000000000000000000000000000000000000000;

    uint constant WORKFLOW_FEATURE_FLAGS = WORKFLOW_CONFIRMATION_NEEDED_FLAG;

    StorageInterface.Address boardController;
    /// @dev Escrow address for FIXED_PRICE dispute
    StorageInterface.Address escrowAddress;

    StorageInterface.UInt jobsCount;

    StorageInterface.UIntUIntMapping jobState;
    StorageInterface.UIntAddressMapping jobClient;  // jobId => jobClient
    StorageInterface.UIntAddressMapping jobWorker;  // jobId => jobWorker
    StorageInterface.UIntBytes32Mapping jobDetailsIPFSHash;

    StorageInterface.UIntUIntMapping jobSkillsArea;  // jobId => jobSkillsArea
    StorageInterface.UIntUIntMapping jobSkillsCategory;  // jobId => jobSkillsCategory
    StorageInterface.UIntUIntMapping jobSkills;  // jobId => jobSkills

    StorageInterface.UIntUIntMapping jobCreatedAt;
    StorageInterface.UIntUIntMapping jobAcceptedAt;
    StorageInterface.UIntUIntMapping jobPendingStartAt;
    StorageInterface.UIntUIntMapping jobStartTime;
    StorageInterface.UIntUIntMapping jobPendingFinishAt;
    StorageInterface.UIntUIntMapping jobFinishTime;
    StorageInterface.UIntBoolMapping jobPaused;
    StorageInterface.UIntUIntMapping jobPausedAt;
    StorageInterface.UIntUIntMapping jobPausedFor;

    /// @dev Workflow type for a job
    StorageInterface.UIntUIntMapping jobWorkflowType;  // jobId => workflow type

    /// @dev Default pay for a posted job that are recommended for offers
    StorageInterface.UIntUIntMapping jobDefaultPay;  // jobId => default pay size
    StorageInterface.UIntAddressUIntMapping jobOfferRate; // Per minute.
    StorageInterface.UIntAddressUIntMapping jobOfferEstimate; // In minutes.
    StorageInterface.UIntAddressUIntMapping jobOfferOntop; // Getting to the workplace, etc.

    /// @dev mapping(client address => set(job ids))
    StorageInterface.UIntSetMapping clientJobs;
    /// @dev mapping(worker's address => set(job ids))
    StorageInterface.UIntSetMapping workerJobs;
    /// @dev mapping(posted offer job id => set(worker addresses))
    StorageInterface.AddressesSetMapping jobOffers;

    StorageInterface.UIntBoolMapping bindStatus;

    // At which state job has been marked as FINALIZED
    StorageInterface.UIntUIntMapping jobFinalizedAt;

    function JobDataCore(
        Storage _store,
        bytes32 _crate
    )
    StorageAdapter(_store, _crate)
    public
    {
    }

    function _init() internal returns (uint) {
        boardController.init("boardController");
        escrowAddress.init("escrowAddress");

        jobsCount.init("jobsCount");

        jobState.init("jobState");
        jobClient.init("jobClient");
        jobWorker.init("jobWorker");
        jobDetailsIPFSHash.init("jobDetailsIPFSHash");

        jobSkillsArea.init("jobSkillsArea");
        jobSkillsCategory.init("jobSkillsCategory");
        jobSkills.init("jobSkills");

        jobCreatedAt.init("jobCreatedAt");
        jobAcceptedAt.init("jobAcceptedAt");
        jobPendingStartAt.init("jobPendingStartAt");
        jobStartTime.init("jobStartTime");
        jobPendingFinishAt.init("jobPendingFinishAt");
        jobFinishTime.init("jobFinishTime");
        jobPaused.init("jobPaused");
        jobPausedAt.init("jobPausedAt");
        jobPausedFor.init("jobPausedFor");

        jobWorkflowType.init("jobWorkflowType");
        jobDefaultPay.init("jobDefaultPay");
        jobOfferRate.init("jobOfferRate");
        jobOfferEstimate.init("jobOfferEstimate");
        jobOfferOntop.init("jobOfferOntop");

        jobFinalizedAt.init("jobFinalizedAt");

        clientJobs.init("clientJobs");
        workerJobs.init("workerJobs");
        jobOffers.init("jobOffers");

        bindStatus.init("bindStatus");
            
        return OK;
    }

    function _isValidFlow(uint _flow) internal pure returns (bool) {
        uint _flowType = _flow & ~WORKFLOW_FEATURE_FLAGS;
        uint _featureFlags = _flow & WORKFLOW_FEATURE_FLAGS;
        if (!(_isSingleFlag(_flowType) && _flowType <= WORKFLOW_MAX)) {
            return false;
        }

        bool _featuresApproved = 
            (WORKFLOW_TM == _flowType && _hasFlags(WORKFLOW_TM_FEATURES_ALLOWED, _featureFlags)) ||
            (WORKFLOW_FIXED_PRICE == _flowType && _hasFlags(WORKFLOW_FIXED_PRICE_FEATURES_ALLOWED, _featureFlags));
        if (!_featuresApproved) {
            return false;
        }

        return true;
    }
}
