/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";
import "../JobDataCore.sol";
import "../JobsDataProvider.sol";


contract UserLibraryInterface {
    function hasSkills(address _user, uint _area, uint _category, uint _skills) public view returns (bool);
}

contract BoardControllerInterface {
    function isBoardExists(uint _boardId) public view returns (bool);
    function bindJobWithBoard(uint _boardId, uint _jobId) public view returns (uint);
    function getBoardStatus(uint _boardId) public view returns (bool);
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


contract JobControllerEmitter is MultiEventsHistoryAdapter {
    
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

    function _emitErrorCode(uint _errorCode) internal returns (uint) {
        if (msg.value > 0) {
            msg.sender.transfer(msg.value);
        }
        return super._emitErrorCode(_errorCode);
    }

    function _emitter() internal view returns (JobControllerEmitter) {
        return JobControllerEmitter(getEventsHistory());
    }
}


contract JobControllerCore {

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
    uint constant JOB_CONTROLLER_INVALID_BOARD = JOB_CONTROLLER_SCOPE + 12;

    PaymentProcessorInterface public paymentProcessor;
    UserLibraryInterface public userLibrary;
    JobsDataProvider public jobsDataProvider;
}


contract JobControllerAbstract is JobControllerEmitter, JobDataCore, JobControllerCore {

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

    modifier onlyValidBoard(uint _boardId) {
        BoardControllerInterface _boardController = BoardControllerInterface(store.get(boardController));
        if (!_boardController.isBoardExists(_boardId)) {
            _emitErrorCode(JOB_CONTROLLER_INVALID_BOARD);
            assembly {
                mstore(0, 13012) // JOB_CONTROLLER_INVALID_BOARD
                return(0, 32)
            }
        }
        _;
    }

}