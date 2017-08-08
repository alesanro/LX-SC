"use strict";

const ManagerMock = artifacts.require('./ManagerMock.sol');
const Mock = artifacts.require('./Mock.sol');
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const Roles2LibraryInterface = artifacts.require('./Roles2LibraryInterface.sol');
const SkillsLibrary = artifacts.require('./SkillsLibrary.sol');
const Storage = artifacts.require('solidity-storage-lib/contracts/Storage.sol');

const Asserts = require('./helpers/asserts');
const Reverter = require('./helpers/reverter');


contract('SkillsLibrary', function(accounts) {
  const reverter = new Reverter(web3);
  afterEach('revert', reverter.revert);

  const asserts = Asserts(assert);
  let storage;
  let multiEventsHistory;
  let skillsLibrary;
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

  const getFlag = index => {
    return web3.toBigNumber(2).pow(index*2);
  };

  const getEvenFlag = index => {
    return web3.toBigNumber(2).pow(index*2 + 1);
  };

  const equal = (a, b) => {
    return a.valueOf() === b.valueOf();
  };

  const FROM_NON_OWNER = { from: accounts[1] };

  before('setup', () => {
    return Mock.deployed()
    .then(instance => mock = instance)
    .then(() => ignoreAuth())
    .then(() => Storage.deployed())
    .then(instance => storage = instance)
    .then(() => ManagerMock.deployed())
    .then(instance => storage.setManager(instance.address))
    .then(() => SkillsLibrary.deployed())
    .then(instance => skillsLibrary = instance)
    .then(() => MultiEventsHistory.deployed())
    .then(instance => multiEventsHistory = instance)
    .then(() => skillsLibrary.setupEventsHistory(multiEventsHistory.address))
    .then(() => multiEventsHistory.authorize(skillsLibrary.address))
    .then(reverter.snapshot);
  });

  it('should be able to set area hash', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const area = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.getArea(area))
    .then(asserts.equal(hash))
    .then(() => true);
  });

  it('should be able to rewrite area hash', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.setArea(area, hash2))
    .then(() => skillsLibrary.getArea(area))
    .then(asserts.equal(hash2))
    .then(() => true);
  });

  it('should store hashes for different areas', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const area2 = getFlag(1);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.setArea(area2, hash2))
    .then(() => skillsLibrary.getArea(area))
    .then(asserts.equal(hash))
    .then(() => skillsLibrary.getArea(area2))
    .then(asserts.equal(hash2))
    .then(() => true);
  });

  it.skip('should not set area from non owner', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const area = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash, FROM_NON_OWNER))
    .then(() => skillsLibrary.getArea(area))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should check auth on set area', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const area = getFlag(0);
    return Promise.resolve()
    .then(() => ignoreAuth(false))
    .then(() => mock.expect(
      skillsLibrary.address,
      0,
      roles2LibraryInterface.canCall.getData(
        accounts[0],
        skillsLibrary.address,
        skillsLibrary.contract.setArea.getData().slice(0, 10)
      ), 0)
    )
    .then(() => skillsLibrary.setArea(area, hash))
    .then(assertExpectations())
    .then(() => true);
  });

  it('should not set area with even flag', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const area = getEvenFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.getArea(area))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should not set area with multiple flags', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const area = getFlag(0).add(getFlag(1));
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.getArea(area))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should emit AreaSet event when area set', () => {
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const area = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].address, multiEventsHistory.address);
      assert.equal(result.logs[0].event, 'AreaSet');
      equal(result.logs[0].args.area, area);
      equal(result.logs[0].args.hash, hash);
    })
    .then(() => true);
  });

  it('should be able to set category hash', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(hash))
    .then(() => true);
  });

  it('should be able to rewrite category hash', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setCategory(area, category, hash2))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(hash2))
    .then(() => true);
  });

  it('should store hashes for different categories', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const category2 = getFlag(1);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setCategory(area, category2, hash2))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(hash))
    .then(() => skillsLibrary.getCategory(area, category2))
    .then(asserts.equal(hash2))
    .then(() => true);
  });

  it('should not set category for non existing area', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it.skip('should not set category from non owner', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash, FROM_NON_OWNER))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should check auth on set category', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => ignoreAuth(false))
    .then(() => mock.expect(
      skillsLibrary.address,
      0,
      roles2LibraryInterface.canCall.getData(
        accounts[0],
        skillsLibrary.address,
        skillsLibrary.contract.setCategory.getData().slice(0, 10)
      ), 0)
    )
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(assertExpectations())
    .then(() => true);
  });

  it('should not set category with even flag', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getEvenFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should not set category with multiple flags', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0).add(getFlag(1));
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.getCategory(area, category))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should emit CategorySet event when category set', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, hash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].address, multiEventsHistory.address);
      assert.equal(result.logs[0].event, 'CategorySet');
      equal(result.logs[0].args.area, area);
      equal(result.logs[0].args.category, category);
      equal(result.logs[0].args.hash, hash);
    })
    .then(() => true);
  });

  it('should be able to set skill hash', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(hash))
    .then(() => true);
  });

  it('should be able to rewrite skill hash', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash2))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(hash2))
    .then(() => true);
  });

  it('should store hashes for different skills', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const hash2 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff000000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    const skill2 = getFlag(1);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill2, hash2))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(hash))
    .then(() => skillsLibrary.getSkill(area, category, skill2))
    .then(asserts.equal(hash2))
    .then(() => true);
  });

  it('should not set skill for non existing category', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(0))
    .then(() => 0);
  });

  it.skip('should not set skill from non owner', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash, FROM_NON_OWNER))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should check auth on set skill', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => ignoreAuth(false))
    .then(() => mock.expect(
      skillsLibrary.address,
      0,
      roles2LibraryInterface.canCall.getData(
        accounts[0],
        skillsLibrary.address,
        skillsLibrary.contract.setSkill.getData().slice(0, 10)
      ), 0)
    )
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(assertExpectations())
    .then(() => true);
  });

  it('should not set category from non owner', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const area = getFlag(0);
    const category = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => ignoreAuth(false))
    .then(() => mock.expect(
      skillsLibrary.address,
      0,
      roles2LibraryInterface.canCall.getData(
        accounts[0],
        skillsLibrary.address,
        skillsLibrary.contract.setCategory.getData().slice(0, 10)
      ), 0)
    )
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(assertExpectations())
    .then(() => true);
  });

  it('should set skill with even flag', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getEvenFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(hash))
    .then(() => true);
  });

  it('should not set skill with multiple flags', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0).add(getEvenFlag(0));
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(() => skillsLibrary.getSkill(area, category, skill))
    .then(asserts.equal(0))
    .then(() => true);
  });

  it('should emit SkillSet event when skill set', () => {
    const areaHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const categoryHash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00';
    const hash = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000';
    const area = getFlag(0);
    const category = getFlag(0);
    const skill = getFlag(0);
    return Promise.resolve()
    .then(() => skillsLibrary.setArea(area, areaHash))
    .then(() => skillsLibrary.setCategory(area, category, hash))
    .then(() => skillsLibrary.setSkill(area, category, skill, hash))
    .then(result => {
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].address, multiEventsHistory.address);
      assert.equal(result.logs[0].event, 'SkillSet');
      equal(result.logs[0].args.area, area);
      equal(result.logs[0].args.category, category);
      equal(result.logs[0].args.skill, skill);
      equal(result.logs[0].args.hash, hash);
    })
    .then(() => true);
  });
});
