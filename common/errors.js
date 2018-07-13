const errorScope = {
    boardController: 11000,
    erc20library: 12000,
    jobcontroller: 13000,
    paymentgateway: 15000,
    paymentprocessor: 16000,
    ratingsandreputation: 17000,
    roles: 20000,
}

const errorCodes = {

    UNAUTHORIZED: 0,
    OK: 1,

    BOARD_CONTROLLER_JOB_IS_ALREADY_BINDED: errorScope.boardController + 1,
    BOARD_CONTROLLER_USER_IS_ALREADY_BINDED: errorScope.boardController + 2,
    BOARD_CONTROLLER_USER_IS_NOT_BINDED: errorScope.boardController + 3,
    BOARD_CONTROLLER_BOARD_IS_CLOSED: errorScope.boardController + 4,

    ERC20_LIBRARY_CONTRACT_EXISTS: errorScope.erc20library + 1,
    ERC20_LIBRARY_CONTRACT_DOES_NOT_EXIST: errorScope.erc20library + 2,

    JOB_CONTROLLER_INVALID_ESTIMATE: errorScope.jobcontroller + 1,
    JOB_CONTROLLER_INVALID_SKILLS: errorScope.jobcontroller + 2,
    JOB_CONTROLLER_INVALID_STATE: errorScope.jobcontroller + 3,
    JOB_CONTROLLER_WORKER_RATE_NOT_SET: errorScope.jobcontroller + 4,
    JOB_CONTROLLER_WORK_IS_ALREADY_PAUSED: errorScope.jobcontroller + 5,
    JOB_CONTROLLER_WORK_IS_NOT_PAUSED: errorScope.jobcontroller + 6,
    JOB_CONTROLLER_INVALID_WORKFLOW_TYPE: errorScope.jobcontroller + 7,
    JOB_CONTROLLER_INVALID_ROLE: errorScope.jobcontroller + 8,


    PAYMENT_GATEWAY_INSUFFICIENT_BALANCE: errorScope.paymentgateway + 1,
    PAYMENT_GATEWAY_TRANSFER_FAILED: errorScope.paymentgateway + 2,
    PAYMENT_GATEWAY_NO_FEE_ADDRESS_DESTINATION: errorScope.paymentgateway + 3,

    PAYMENT_PROCESSOR_OPERATION_IS_NOT_APPROVED: errorScope.paymentprocessor + 1,

    RATING_AND_REPUTATION_CANNOT_SET_RATING: errorScope.ratingsandreputation + 1,
    RATING_AND_REPUTATION_RATING_IS_ALREADY_SET: errorScope.ratingsandreputation + 2,
    RATING_AND_REPUTATION_INVALID_RATING: errorScope.ratingsandreputation + 3,
    RATING_AND_REPUTATION_WORKER_IS_NOT_ACTIVE: errorScope.ratingsandreputation + 4,
    RATING_AND_REPUTATION_INVALID_AREA_OR_CATEGORY: errorScope.ratingsandreputation + 5,
    RATING_AND_REPUTATION_INVALID_EVALUATION: errorScope.ratingsandreputation + 6,

    ROLES_ALREADY_EXISTS: errorScope.roles + 1,
    ROLES_INVALID_INVOCATION: errorScope.roles + 2,
    ROLES_NOT_FOUND: errorScope.roles + 3,
}

module.exports = errorCodes
