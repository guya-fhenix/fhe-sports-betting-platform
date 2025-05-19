import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, EventLog } from "ethers";
import { Factory } from "../typechain-types";

describe("Factory", function () {
  let factory: Factory;
  let owner: Signer;
  let user: Signer;
  let addr1: string;
  let addr2: string;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    addr1 = await owner.getAddress();
    addr2 = await user.getAddress();
    const Factory = await ethers.getContractFactory("Factory");
    factory = await Factory.connect(owner).deploy();
    await factory.waitForDeployment();
  });

  it("should set the deployer as platformAdmin", async function () {
    expect(await factory.platformAdmin()).to.equal(addr1);
  });

  it("should allow only platformAdmin to set a new admin", async function () {
    await expect(factory.connect(user).setPlatformAdmin(addr2)).to.be.revertedWith(
      "Only platform admin can perform this action"
    );
    await factory.setPlatformAdmin(addr2);
    expect(await factory.platformAdmin()).to.equal(addr2);
  });

  it("should not allow setting admin to zero address", async function () {
    await expect(factory.setPlatformAdmin(ethers.ZeroAddress)).to.be.revertedWith(
      "New admin cannot be zero address"
    );
  });

  it("should allow only platformAdmin to withdraw all platform fees", async function () {
    await expect(factory.connect(user).withdrawPlatformFees()).to.be.revertedWith(
      "Only platform admin can perform this action"
    );
  });

  it("should allow only platformAdmin to withdraw partial fees", async function () {
    await expect(factory.connect(user).withdrawPartialFees(1)).to.be.revertedWith(
      "Only platform admin can perform this action"
    );
  });

  it("should revert if no fees to withdraw", async function () {
    await expect(factory.withdrawPlatformFees()).to.be.revertedWith("No fees to withdraw");
  });

  it("should revert if partial withdraw amount is zero or too high", async function () {
    await expect(factory.withdrawPartialFees(0)).to.be.revertedWith("Amount must be greater than zero");
    await expect(factory.withdrawPartialFees(1)).to.be.revertedWith("Insufficient balance");
  });

  describe("Tournament creation", function () {
    let bettingOpportunities: any[];
    beforeEach(() => {
      bettingOpportunities = [
        {
          id: 1,
          description: "Race 1",
          startTime: Math.floor(Date.now() / 1000) + 1000,
          options: [1, 2, 3],
        },
        {
          id: 2,
          description: "Race 2",
          startTime: Math.floor(Date.now() / 1000) + 2000,
          options: [1, 2],
        },
      ];
    });

    it("should create a tournament and emit event", async function () {
      const tx = await factory.createTournament(
        "Test Tournament",
        Math.floor(Date.now() / 1000) + 500,
        Math.floor(Date.now() / 1000) + 5000,
        bettingOpportunities
      );
      const receipt = await tx.wait();
      const event = receipt?.logs?.find((e: any) => (e as EventLog).eventName === "TournamentCreated") as EventLog | undefined;
      expect(event).to.exist;
      expect(await factory.getAllTournaments()).to.have.lengthOf(1);
    });

    it("should revert if description is empty", async function () {
      await expect(
        factory.createTournament("", Math.floor(Date.now() / 1000) + 1, Math.floor(Date.now() / 1000) + 2, bettingOpportunities)
      ).to.be.revertedWith("Description cannot be empty");
    });

    it("should revert if startTime >= endTime", async function () {
      await expect(
        factory.createTournament("desc", 1000, 1000, bettingOpportunities)
      ).to.be.revertedWith("End time must be after start time");
    });

    it("should revert if no betting opportunities", async function () {
      await expect(
        factory.createTournament("desc", 1, 2, [])
      ).to.be.revertedWith("Must have at least one betting opportunity");
    });

    it("should revert if duplicate betting opportunity IDs", async function () {
      const dupe = [...bettingOpportunities, { ...bettingOpportunities[0] }];
      await expect(
        factory.createTournament("desc", 1, 2, dupe)
      ).to.be.revertedWith("Duplicate betting opportunity ID");
    });

    it("should revert if betting opportunity has no options", async function () {
      const bad = [{ ...bettingOpportunities[0], options: [] }];
      await expect(
        factory.createTournament("desc", 1, 2, bad)
      ).to.be.revertedWith("Must provide at least one option");
    });
  });

  describe("Betting group creation", function () {
    let tournamentAddress: string;
    let bettingOpportunities: any[];
    let startTime: number;
    let endTime: number;
    beforeEach(async () => {
      startTime = Math.floor(Date.now() / 1000) + 100000;
      endTime = startTime + 1000;
      bettingOpportunities = [
        {
          id: 1,
          description: "Race 1",
          startTime,
          options: [1, 2, 3],
        },
      ];
      const tx = await factory.createTournament(
        "Test Tournament",
        startTime,
        endTime,
        bettingOpportunities
      );
      const receipt = await tx.wait();
      const event = receipt?.logs?.find((e: any) => (e as EventLog).eventName === "TournamentCreated") as EventLog | undefined;
      tournamentAddress = event?.args?.tournamentAddress;
    });

    it("should create a betting group and emit event", async function () {
      const tx = await factory.createBettingGroup(
        "Group 1",
        tournamentAddress,
        ethers.parseEther("1"),
        [995],
        60
      );
      const receipt = await tx.wait();
      const event = receipt?.logs?.find((e: any) => (e as EventLog).eventName === "BettingGroupCreated") as EventLog | undefined;
      expect(event).to.exist;
      expect(await factory.getAllBettingGroups()).to.have.lengthOf(1);
    });

    it("should revert if description is empty", async function () {
      await expect(
        factory.createBettingGroup("", tournamentAddress, 1, [995], 60)
      ).to.be.revertedWith("Description cannot be empty");
    });

    it("should revert if tournament contract is zero address", async function () {
      await expect(
        factory.createBettingGroup("desc", ethers.ZeroAddress, 1, [995], 60)
      ).to.be.revertedWith("Tournament contract cannot be zero address");
    });

    it("should revert if tournament contract not created by this factory", async function () {
      const [other] = await ethers.getSigners();
      const Factory2 = await ethers.getContractFactory("Factory");
      const factory2 = await Factory2.connect(other).deploy();
      await factory2.waitForDeployment();
      const tx = await factory2.createTournament(
        "Other Tournament",
        startTime,
        endTime,
        bettingOpportunities
      );
      const receipt = await tx.wait();
      const event = receipt?.logs?.find((e: any) => (e as EventLog).eventName === "TournamentCreated") as EventLog | undefined;
      const otherTournament = event?.args?.tournamentAddress;
      await expect(
        factory.createBettingGroup("desc", otherTournament, 1, [995], 60)
      ).to.be.revertedWith("Tournament contract not created by this factory");
    });

    it("should revert if general closing window is out of range", async function () {
      await expect(
        factory.createBettingGroup("desc", tournamentAddress, 1, [995], 59)
      ).to.be.revertedWith("General closing window must be between 1 minute and 1 day");
      await expect(
        factory.createBettingGroup("desc", tournamentAddress, 1, [995], 86401)
      ).to.be.revertedWith("General closing window must be between 1 minute and 1 day");
    });

    it("should revert if prize distribution is empty or too long", async function () {
      await expect(
        factory.createBettingGroup("desc", tournamentAddress, 1, [], 60)
      ).to.be.revertedWith("Prize distribution must have at least one entry");
      await expect(
        factory.createBettingGroup("desc", tournamentAddress, 1, new Array(11).fill(100), 60)
      ).to.be.revertedWith("Prize distribution cannot exceed 10 entries");
    });

    it("should revert if prize distribution does not sum to 99.5%", async function () {
      await expect(
        factory.createBettingGroup("desc", tournamentAddress, 1, [900], 60)
      ).to.be.revertedWith("Prize distribution must sum to 99.5% (995/1000)");
    });

    it("should revert if tournament has already started", async function () {
      const Tournament = await ethers.getContractAt("Tournament", tournamentAddress);
      const start = await Tournament.startTime();
      const block = await ethers.provider.getBlock("latest");
      if (!block) throw new Error("Failed to get latest block");
      const now = block.timestamp;
      const jump = Number(start) - now + 1;
      await ethers.provider.send("evm_increaseTime", [jump]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        factory.createBettingGroup("desc", tournamentAddress, 1, [995], 60)
      ).to.be.revertedWith("Tournament has already started");
    });
  });
}); 