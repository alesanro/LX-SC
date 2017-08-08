pragma solidity 0.4.8;

import './adapters/Roles2LibraryAdapter.sol';
import 'solidity-eventshistory-lib/contracts/AbstractMultiEventsHistory.sol';


/**
 * @title Events History universal multi contract.
 *
 * Contract serves as an Events storage for any type of contracts.
 * Events appear on this contract address but their definitions provided by calling contracts.
 *
 * Note: all the non constant functions return false instead of throwing in case if state change
 * didn't happen yet.
 */
contract MultiEventsHistory is AbstractMultiEventsHistory, Roles2LibraryAdapter {

    function MultiEventsHistory(address _roles2Library) Roles2LibraryAdapter(_roles2Library) {}
}
