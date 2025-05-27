import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("Tournament", function () {
  let tournament: Contract;
  let owner: Signer;
  let user: Signer;
  let addr1: string;
  let addr2: string;
  let bettingOpportunities: any[];
  let startTime: number;
  let endTime: number;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    addr1 = await owner.getAddress();
    addr2 = await user.getAddress();
    startTime = Math.floor(Date.now() / 1000) + 1000;
    endTime = startTime + 1000;
    bettingOpportunities = [
      {
        id: 1,
        description: "Race 1",
        startTime,
        options: [1, 2, 3],
      },
      {
        id: 2,
        description: "Race 2",
        startTime: startTime + 100,
        options: [1, 2],
      },
    ];
    const Tournament = await ethers.getContractFactory("Tournament");
    tournament = (await Tournament.connect(owner).deploy(
      addr1,
      "Test Tournament",
      startTime,
      endTime,
      bettingOpportunities
    )) as unknown as Contract;
    await tournament.waitForDeployment();
  });

  it("should set the correct admin, description, startTime, and endTime", async function () {
    expect(await tournament.platformAdmin()).to.equal(addr1);
    expect(await tournament.description()).to.equal("Test Tournament");
    expect(await tournament.startTime()).to.equal(startTime);
    expect(await tournament.endTime()).to.equal(endTime);
  });

  it("should only allow admin to update betting opportunity start time", async function () {
    await expect(
      (tournament as any).connect(user).updateBettingOpportunityStartTime(1, startTime + 200)
    ).to.be.revertedWith("Only platform admin can perform this action");
  });

  it("should revert if betting opportunity does not exist", async function () {
    await expect(
      (tournament as any).updateBettingOpportunityStartTime(99, startTime + 200)
    ).to.be.revertedWith("Betting opportunity does not exist");
  });

  it("should revert if start time is not greater than 0 or not in the future", async function () {
    // Deploy a tournament with a betting opportunity with startTime 0
    const Tournament = await ethers.getContractFactory("Tournament");
    const bet0 = [{ id: 10, description: "Race 0", startTime: 0, options: [1, 2] }];
    const t0 = await Tournament.connect(owner).deploy(
      addr1,
      "T0",
      startTime,
      endTime,
      bet0
    );
    await t0.waitForDeployment();
    // Try to update with 0
    await expect(
      (t0 as any).updateBettingOpportunityStartTime(10, 0)
    ).to.be.revertedWith("Start time must be greater than 0");
    // Try to update with a past value
    await expect(
      (t0 as any).updateBettingOpportunityStartTime(10, Math.floor(Date.now() / 1000) - 1)
    ).to.be.revertedWith("Start time must be in the future");
  });

  it("should update betting opportunity start time", async function () {
    // Deploy a tournament with a betting opportunity with startTime 0
    const Tournament = await ethers.getContractFactory("Tournament");
    const bet0 = [{ id: 11, description: "Race 11", startTime: 0, options: [1, 2] }];
    const t0 = await Tournament.connect(owner).deploy(
      addr1,
      "T0",
      startTime,
      endTime,
      bet0
    );
    await t0.waitForDeployment();
    const block = await ethers.provider.getBlock("latest");
    if (!block) throw new Error("Failed to get latest block");
    const now = block.timestamp;
    const newStart = now + 10000;
    await (t0 as any).updateBettingOpportunityStartTime(11, newStart);
    // No revert means success
  });

  it("should only allow admin to set results", async function () {
    await expect(
      (tournament as any).connect(user).setResults(1, 1, endTime)
    ).to.be.revertedWith("Only platform admin can perform this action");
  });

  it("should revert if betting opportunity does not exist when setting results", async function () {
    await expect(
      (tournament as any).setResults(99, 1, endTime)
    ).to.be.revertedWith("Betting opportunity does not exist");
  });

  it("should revert if results already finalized", async function () {
    await tournament.setResults(1, 1, endTime);
    await expect(
      tournament.setResults(1, 1, endTime + 1)
    ).to.be.revertedWith("Results already finalized");
  });

  it("should revert if end time is not greater than 0 or before start time", async function () {
    await expect(
      tournament.setResults(1, 1, 0)
    ).to.be.revertedWith("End time must be greater than 0");
    await expect(
      tournament.setResults(1, 1, startTime - 1)
    ).to.be.revertedWith("End time must be after start time");
  });

  it("should revert if start time is not set before setting results", async function () {
    // Deploy a new tournament with startTime 0 for bet 3
    const Tournament = await ethers.getContractFactory("Tournament");
    const bet3 = [{ id: 3, description: "Race 3", startTime: 0, options: [1, 2] }];
    const t2 = await Tournament.connect(owner).deploy(
      addr1,
      "T2",
      startTime,
      endTime,
      bet3
    );
    await t2.waitForDeployment();
    await expect(
      (t2 as any).setResults(3, 1, endTime)
    ).to.be.revertedWith("Start time must be set before setting results");
  });

  it("should revert if trying to set results before betting opportunity start time", async function () {
    // Deploy a new tournament with a future start time
    const Tournament = await ethers.getContractFactory("Tournament");
    const block = await ethers.provider.getBlock("latest");
    if (!block) throw new Error("Failed to get latest block");
    const now = block.timestamp;
    const futureStartTime = now + 3600; // 1 hour in the future
    
    const bet4 = [{ id: 4, description: "Race 4", startTime: futureStartTime, options: ["Option 1", "Option 2"] }];
    const t3 = await Tournament.connect(owner).deploy(
      addr1,
      "T3",
      startTime,
      endTime,
      bet4
    );
    await t3.waitForDeployment();
    
    // Try to set results before the betting opportunity starts
    await expect(
      (t3 as any).setResults(4, 1, futureStartTime + 100)
    ).to.be.revertedWith("Betting opportunity has not started yet");
  });

  it("should set results and mark as finalized", async function () {
    await tournament.setResults(1, 2, endTime);
    const result = await tournament.getResults(1);
    expect(result).to.equal(2);
  });

  it("should return options for a betting opportunity", async function () {
    const options = await tournament.getOptions(1);
    expect(options.map((x: any) => Number(x))).to.deep.equal([1, 2, 3]);
  });

  it("should revert if getting options for non-existent bet", async function () {
    await expect(tournament.getOptions(99)).to.be.revertedWith("Betting opportunity does not exist");
  });

  it("should revert if getting results for non-existent bet", async function () {
    await expect(tournament.getResults(99)).to.be.revertedWith("Betting opportunity does not exist");
  });

  it("should check if betting window is open (false if not set)", async function () {
    // Deploy a tournament with a betting opportunity with startTime 0
    const Tournament = await ethers.getContractFactory("Tournament");
    const bet0 = [{ id: 12, description: "Race 12", startTime: 0, options: [1, 2] }];
    const t0 = await Tournament.connect(owner).deploy(
      addr1,
      "T0",
      startTime,
      endTime,
      bet0
    );
    await t0.waitForDeployment();
    // Should be false when not set
    const closingWindow = 60;
    let isOpen = await t0.isBettingWindowOpen(12, closingWindow);
    expect(isOpen).to.equal(false);
    // Set start time far in the future so window is open
    const block = await ethers.provider.getBlock("latest");
    if (!block) throw new Error("Failed to get latest block");
    const now = block.timestamp;
    const newStart = now + closingWindow + 300; // Add a bigger buffer
    await (t0 as any).updateBettingOpportunityStartTime(12, newStart);
    isOpen = await t0.isBettingWindowOpen(12, closingWindow);
    expect(isOpen).to.equal(true);
    // Set results to close window
    await (t0 as any).setResults(12, 1, newStart + 1);
    const isOpen2 = await t0.isBettingWindowOpen(12, closingWindow);
    expect(isOpen2).to.equal(false);
  });
}); 