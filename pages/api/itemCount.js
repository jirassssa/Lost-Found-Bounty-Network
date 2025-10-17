import { ethers } from 'ethers'
import CONTRACT_ABI from '../../src/config/abi.json'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
const RPC_URL = 'https://mainnet.base.org'

export default async function handler(req, res) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

    const itemCount = await contract.itemCounter()

    res.status(200).json({ itemCount: Number(itemCount) })
  } catch (error) {
    console.error('Error fetching item count:', error)
    res.status(500).json({ error: 'Failed to fetch item count' })
  }
}
