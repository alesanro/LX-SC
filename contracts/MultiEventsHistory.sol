/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.18;


import "solidity-roles-lib/contracts/Roles2LibraryAdapter.sol";
import {MultiEventsHistory as BasicMultiEventsHistory} from "solidity-eventshistory-lib/contracts/MultiEventsHistory.sol";


/**
 * @title Events History universal multi contract.
 *
 * Contract serves as an Events storage for any type of contracts.
 * Events appear on this contract address but their definitions provided by calling contracts.
 *
 * Note: all the non constant functions return false instead of throwing in case if state change
 * didn't happen yet.
 */
contract MultiEventsHistory is BasicMultiEventsHistory, Roles2LibraryAdapter {

    modifier onlyAuthorized {
        if (!_isAuthorized(msg.sender, msg.sig)) {
            emit AuthFailedError(this, msg.sender, msg.sig);
            return;
        }
        _;
    }

    constructor(address _roles2Library) public Roles2LibraryAdapter(_roles2Library) {
    }
}
