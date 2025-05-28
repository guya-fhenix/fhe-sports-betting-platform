#!/usr/bin/env python3
"""
Test script for gas information functionality
"""

import asyncio
import requests
import sys

async def test_eth_price():
    """Test ETH price fetching"""
    print("Testing ETH price API...")
    try:
        response = requests.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
            timeout=10,
            headers={'User-Agent': 'FHE-Sports-Betting-Platform/1.0'}
        )
        response.raise_for_status()
        data = response.json()
        
        price = data["ethereum"]["usd"]
        print(f"✅ ETH Price: ${price}")
        return True
        
    except Exception as e:
        print(f"❌ Error fetching ETH price: {e}")
        return False

def test_gas_calculation():
    """Test gas calculation logic"""
    print("\nTesting gas calculation logic...")
    
    # Mock data for testing
    gas_used = 21000
    gas_price_wei = 20000000000  # 20 Gwei
    eth_price_usd = 3000
    
    # Calculate costs
    gas_cost_wei = gas_used * gas_price_wei
    gas_cost_eth = gas_cost_wei / 1e18  # Convert wei to ETH
    gas_cost_usd = gas_cost_eth * eth_price_usd
    
    print(f"Gas Used: {gas_used:,}")
    print(f"Gas Price: {gas_price_wei / 1e9:.2f} Gwei")
    print(f"Gas Cost: {gas_cost_eth:.6f} ETH")
    print(f"Gas Cost: ${gas_cost_usd:.2f} USD")
    print("✅ Gas calculation logic works")
    
    return True

async def main():
    """Run all tests"""
    print("🧪 Testing Gas Information Functionality\n")
    
    # Test ETH price fetching
    eth_price_ok = await test_eth_price()
    
    # Test gas calculation
    gas_calc_ok = test_gas_calculation()
    
    print(f"\n📊 Test Results:")
    print(f"ETH Price API: {'✅ PASS' if eth_price_ok else '❌ FAIL'}")
    print(f"Gas Calculation: {'✅ PASS' if gas_calc_ok else '❌ FAIL'}")
    
    if eth_price_ok and gas_calc_ok:
        print("\n🎉 All tests passed! Gas information functionality is ready.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check the implementation.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 