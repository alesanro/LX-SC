"use strict";

const IPFSLibrary = artifacts.require('./IPFSLibrary.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const Storage = artifacts.require('./Storage.sol');

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

  before('setup', () => {
    return Storage.deployed()
    .then(instance => storage = instance)
    .then(() => IPFSLibrary.deployed())
    .then(instance => ipfsLibrary = instance)
    .then(() => MultiEventsHistory.deployed())
    .then(instance => multiEventsHistory = instance)
    .then(reverter.snapshot);
  });

  it('should check auth on setup event history', () => {
    const caller = accounts[1];
    const newAddress = '0xffffffffffffffffffffffffffffffffffffffff';
    return Promise.resolve()
    .then(() => ipfsLibrary.setupEventsHistory(newAddress, {from: caller}))
    .then(() => ipfsLibrary.getEventsHistory.call())
    .then(_eventsHistory => assert.equal(_eventsHistory, multiEventsHistory.address))
  });

  it('should be able to set hash', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    return ipfsLibrary.setHash(key, hash, {from: SENDER})
    .then(() => ipfsLibrary.getHash(SENDER, key))
    .then(asserts.equal(hash));
  });

  it.skip('should error when invalid key was set', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const invalidKey = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    return ipfsLibrary.setHash.call(invalidKey, hash, {from: SENDER})
    .then(assert.isFalse);
  });

  it('should set valid hash when invalid hash was previously set', () => {
    const invalidHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const validHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    return ipfsLibrary.setHash(key, invalidHash, {from: SENDER})
    .then(() => ipfsLibrary.getHash(SENDER, key))
    .then(asserts.equal(validHash));
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

  it('should store hashes for different keys and setters', () => {
    const sender2 = accounts[3];
    const hash1 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00ff';
    const key1 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const key2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    return ipfsLibrary.setHash(key1, hash1, {from: SENDER})
    .then(() => ipfsLibrary.setHash(key2, hash2, {from: sender2}))
    .then(() => ipfsLibrary.getHash(SENDER, key1))
    .then(asserts.equal(hash1))
    .then(() => ipfsLibrary.getHash(sender2, key2))
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
