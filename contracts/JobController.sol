/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import "./base/DelegateRouter.sol";
import "./jobs/JobControllerAbstract.sol";


contract JobController is Roles2LibraryAdapter, JobControllerAbstract, DelegateRouter {

    address internal initiationControllerLib;
    address internal processControllerLib;
    address internal acceptanceControllerLib;

    constructor(
        Storage _store,
        bytes32 _crate,
        address _roles2Library
    )
    Roles2LibraryAdapter(_roles2Library)
    JobDataCore(_store, _crate)
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

    function linkJobLibs(
        address _initiationControllerLib, 
        address _processControllerLib, 
        address _acceptanceControllerLib
    ) 
    external 
    auth 
    returns (uint) 
    {
        initiationControllerLib = _initiationControllerLib;
        processControllerLib = _processControllerLib;
        acceptanceControllerLib = _acceptanceControllerLib;
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
    returns (uint)
    {
        _delegateCall(initiationControllerLib);
    }

    function postJobOffer(
        uint _jobId,
        uint _rate,
        uint _estimate,
        uint _ontop
    )
    public
    returns (uint)
    {
        _delegateCall(initiationControllerLib);
    }

    function postJobOfferWithPrice(
        uint _jobId,
        uint _price
    )
    external
    returns (uint) {
        _delegateCall(initiationControllerLib);
    }

    function acceptOffer(
        uint _jobId,
        address _worker
    )
    external
    payable
    returns (uint _resultCode)
    {
        _delegateCall(initiationControllerLib);
    }

    function startWork(
        uint _jobId
    )
    external
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function confirmStartWork(
        uint _jobId
    )
    external
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function pauseWork(
        uint _jobId
    )
    external
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function resumeWork(
        uint _jobId
    )
    external
    returns (uint _resultCode)
    {
        _delegateCall(processControllerLib);
    }

    function submitAdditionalTimeRequest(
        uint _jobId,
        uint16 _additionalTime
    )
    external
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function acceptAdditionalTimeRequest(
        uint _jobId,
        uint16 _additionalTime
    )
    external
    payable
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function rejectAdditionalTimeRequest(
        uint _jobId
    )
    external
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function endWork(
        uint _jobId
    )
    external
    returns (uint)
    {
        _delegateCall(processControllerLib);
    }

    function cancelJob(
        uint _jobId
    )
    external
    returns (uint _resultCode)
    {
        _delegateCall(acceptanceControllerLib);
    }

    function acceptWorkResults(uint _jobId)
    external
    returns (uint) 
    {
        _delegateCall(acceptanceControllerLib);
    }

    function rejectWorkResults(uint _jobId)
    external
    returns (uint _resultCode) 
    {
        _delegateCall(acceptanceControllerLib);
    }

    function resolveWorkDispute(
        uint _jobId,
        uint _workerPaycheck,
        uint _penaltyFee
    )
    external
    returns (uint _resultCode) {
        _delegateCall(acceptanceControllerLib);
    }

    function releasePayment(
        uint _jobId
    )
    public
    returns (uint _resultCode)
    {
        _delegateCall(acceptanceControllerLib);
    }
}

