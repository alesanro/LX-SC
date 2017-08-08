"use strict";

const IPFSLibrary = artifacts.require('./IPFSLibrary.sol');
const ManagerMock = artifacts.require('./ManagerMock.sol');
const Mock = artifacts.require('./Mock.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const Roles2LibraryInterface = artifacts.require('./Roles2LibraryInterface.sol');
const Storage = artifacts.require('solidity-storage-lib/contracts/Storage.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');


contract('IPFSLibrary', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);
  const SENDER = accounts[1];
  let storage;
  let multiEventsHistory;
  let ipfsLibrary;
  let roles2LibraryInterface = web3.eth.contract(Roles2LibraryInterface.abi).at('0x0');
  let mock;

  const assertExpectations = (expected = 0, callsCount = null) => {
    let expectationsCount;
    return () => {
      return mock.expectationsLeft()
      .then(asserts.equal(expected))
      .then(() => mock.expectationsCount())
      .then(result => expectationsCount = result)
      .then(() => mock.callsCount())
      .then(result => asserts.equal(callsCount === null ? expectationsCount : callsCount)(result));
    };
  };

  const ignoreAuth = (enabled = true) => {
    return mock.ignore(roles2LibraryInterface.canCall.getData().slice(0, 10), enabled);
  };

  before('setup', () => {
    return Mock.deployed()
    .then(instance => mock = instance)
    .then(() => ignoreAuth())
    .then(() => Storage.deployed())
    .then(instance => storage = instance)
    .then(() => ManagerMock.deployed())
    .then(instance => storage.setManager(instance.address))
    .then(() => IPFSLibrary.deployed())
    .then(instance => ipfsLibrary = instance)
    .then(() => MultiEventsHistory.deployed())
    .then(instance => multiEventsHistory = instance)
    .then(() => ipfsLibrary.setupEventsHistory(multiEventsHistory.address))
    .then(() => multiEventsHistory.authorize(ipfsLibrary.address))
    .then(reverter.snapshot);
  });

  it('should check auth on setup event history', () => {
    const caller = accounts[1];
    const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
    return Promise.resolve()
    .then(() => ignoreAuth(false))
    .then(() => mock.expect(
      ipfsLibrary.address,
      0,
      roles2LibraryInterface.canCall.getData(
        caller,
        ipfsLibrary.address,
        ipfsLibrary.contract.setupEventsHistory.getData().slice(0, 10)
      ), 0)
    )
    .then(() => ipfsLibrary.setupEventsHistory(newAddress, {from: caller}))
    .then(assertExpectations());
  });

  it('should be able to set hash', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    return ipfsLibrary.setHash(key, hash, {from: SENDER})
    .then(() => ipfsLibrary.getHash(SENDER, key))
    .then(asserts.equal(hash));
  });

  it('should rewrite hash', () => {
    const hash1 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ff';
    const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    return ipfsLibrary.setHash(key, hash1, {from: SENDER})
    .then(() => ipfsLibrary.setHash(key, hash2, {from: SENDER}))
    .then(() => ipfsLibrary.getHash(SENDER, key))
    .then(asserts.equal(hash2));
  });

  it('should store hashes for different keys', () => {
    const hash1 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ff';
    const key1 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const key2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    return ipfsLibrary.setHash(key1, hash1, {from: SENDER})
    .then(() => ipfsLibrary.setHash(key2, hash2, {from: SENDER}))
    .then(() => ipfsLibrary.getHash(SENDER, key1))
    .then(asserts.equal(hash1))
    .then(() => ipfsLibrary.getHash(SENDER, key2))
    .then(asserts.equal(hash2));
  });

  it('should store hashes from different setters', () => {
    const sender2 = accounts[3];
    const hash1 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ff';
    const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    return ipfsLibrary.setHash(key, hash1, {from: SENDER})
    .then(() => ipfsLibrary.setHash(key, hash2, {from: sender2}))
    .then(() => ipfsLibrary.getHash(SENDER, key))
    .then(asserts.equal(hash1))
    .then(() => ipfsLibrary.getHash(sender2, key))
    .then(asserts.equal(hash2));
  });

  it('should emit "HashSet" event when hash set', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    return ipfsLibrary.setHash(key, hash, {from: SENDER})
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].address, multiEventsHistory.address);
      assert.equal(result.logs[0].event, 'HashSet');
      assert.equal(result.logs[0].args.setter, SENDER);
      assert.equal(result.logs[0].args.key, key);
      assert.equal(result.logs[0].args.hash, hash);
    });
  });
});
