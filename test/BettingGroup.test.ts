import { ethers } from "hardhat";
import { expect } from "chai";

describe("BettingGroup", function () {
  let tournament: any;
  let group: any;
  let owner: any;
  let users: any[];
  let entryFee = ethers.parseEther("1");
  let prizeDistribution = [995];
  let closingWindow = 60;

  beforeEach(async function () {
    [owner, ...users] = await ethers.getSigners();
    // Deploy minimal Tournament mock
    const Tournament = await ethers.getContractFactory("Tournament");
    const now = Math.floor(Date.now() / 1000);
    tournament = await Tournament.deploy(
      owner.address,
      "Test Tournament",
      now + 100,
      now + 10000,
      [
        { id: 1, description: "Race 1", startTime: now + 200, options: [1, 2] },
      ]
    );
    await tournament.waitForDeployment();
    // Deploy BettingGroup
    const BettingGroup = await ethers.getContractFactory("BettingGroup");
    group = await BettingGroup.deploy(
      owner.address,
      "Test Group",
      tournament.target,
      entryFee,
      prizeDistribution,
      closingWindow
    );
    await group.waitForDeployment();
  });

  it("should allow registration and enforce minimum participants", async function () {
    for (let i = 0; i < 9; i++) {
      await group.connect(users[i]).register("user" + i, { value: entryFee });
    }
    expect(await group.participantCount()).to.equal(9);
    await group.connect(users[9]).register("user9", { value: entryFee });
    expect(await group.participantCount()).to.equal(10);
  });

  it("should allow cancel if less than 10 after tournament start", async function () {
    await group.connect(users[0]).register("user0", { value: entryFee });
    // Fast forward to after tournament start
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await expect(group.connect(users[0]).cancelBettingGroup())
      .to.emit(group, "BettingGroupCancelled");
    expect(await group.active()).to.equal(false);
  });

  it("should not allow cancel if 10 or more participants", async function () {
    for (let i = 0; i < 10; i++) {
      await group.connect(users[i]).register("user" + i, { value: entryFee });
    }
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await expect(group.connect(users[0]).cancelBettingGroup()).to.be.revertedWith("Minimum participants met");
  });

  it("should not allow processResults if less than 10 participants", async function () {
    await group.connect(users[0]).register("user0", { value: entryFee });
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await expect(group.processResults(1)).to.be.revertedWith("Not enough participants");
  });

  it("should not allow finalizeAndDistribute if less than 10 participants", async function () {
    await group.connect(users[0]).register("user0", { value: entryFee });
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await expect(group.finalizeAndDistribute()).to.be.revertedWith("Not enough participants");
  });

  it("should allow processResults and finalize if 10 or more participants", async function () {
    for (let i = 0; i < 10; i++) {
      await group.connect(users[i]).register("user" + i, { value: entryFee });
    }
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    // Set result in tournament
    await tournament.setResults(1, 1, (await tournament.endTime()));
    await group.processResults(1);
    // Fast forward to after tournament end
    const endTime = await tournament.endTime();
    const block = await ethers.provider.getBlock("latest");
    if (!block) throw new Error("Failed to get latest block");
    const now = block.timestamp;
    if (now <= endTime) {
      await ethers.provider.send("evm_increaseTime", [Number(endTime) - now + 1]);
      await ethers.provider.send("evm_mine", []);
    }
    // Mark all as scored
    await group.finalizeAndDistribute();
    expect(await group.active()).to.equal(false);
  });
}); 