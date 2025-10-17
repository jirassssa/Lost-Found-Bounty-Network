import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { base } from 'wagmi/chains'
import ConnectButton from '../src/components/ConnectButton'
import CONTRACT_ABI from '../src/config/abi.json'

// Contract configuration - update after deployment
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000'
const REQUIRED_CHAIN_ID = base.id // 8453

export default function Home() {
  const { address, isConnected, chain } = useAccount()
  const [activeTab, setActiveTab] = useState('browse')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [userProfile, setUserProfile] = useState(null)

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    location: '',
    category: '',
    bountyAmount: ''
  })

  const [claimMessage, setClaimMessage] = useState('')
  const [txHash, setTxHash] = useState(null)
  const [showIncreaseBountyModal, setShowIncreaseBountyModal] = useState(false)
  const [increaseBountyAmount, setIncreaseBountyAmount] = useState('')
  const [selectedItemForBounty, setSelectedItemForBounty] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [publicItemCount, setPublicItemCount] = useState(0)

  const { writeContract, isPending: isWritePending, data: writeData } = useWriteContract()
  const { switchChain } = useSwitchChain()

  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Check if on correct network
  const isCorrectNetwork = chain?.id === REQUIRED_CHAIN_ID
  const canInteract = isConnected && isCorrectNetwork

  const { data: itemCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'itemCounter',
  })

  const { data: profileData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getUserProfile',
    args: address ? [address] : undefined,
  })

  useEffect(() => {
    if (profileData) {
      setUserProfile({
        itemsReported: Number(profileData[0]),
        itemsFound: Number(profileData[1]),
        totalBountyEarned: formatEther(profileData[2]),
        reputationScore: Number(profileData[3]),
        isRegistered: profileData[4]
      })
    }
  }, [profileData])

  // Load all items for everyone (no wallet required)
  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    setLoadingLeaderboard(true)

    try {
      const response = await fetch('/api/items/all')
      if (!response.ok) throw new Error('Failed to load items')

      const data = await response.json()
      const loadedItems = data.items || []

      // Set items (reversed to show newest first)
      setItems(loadedItems.reverse())
      setPublicItemCount(data.itemCount)

      // Calculate leaderboard from loaded items
      const finderStats = {}
      loadedItems.forEach(item => {
        // Only count resolved items with confirmed finders
        if (item.isResolved && item.finder && item.finder !== '0x0000000000000000000000000000000000000000') {
          if (!finderStats[item.finder]) {
            finderStats[item.finder] = {
              address: item.finder,
              itemsFound: 0,
              totalEarned: BigInt(0)
            }
          }
          finderStats[item.finder].itemsFound++
          // Calculate finder reward (bounty - 2% platform fee)
          const bounty = BigInt(item.bountyAmount)
          const finderReward = bounty - (bounty * BigInt(2) / BigInt(100))
          finderStats[item.finder].totalEarned += finderReward
        }
      })

      // Convert to array and sort by total earned
      const leaderboardArray = Object.values(finderStats)
        .sort((a, b) => {
          const diff = b.totalEarned - a.totalEarned
          return diff > 0 ? 1 : diff < 0 ? -1 : 0
        })
        .slice(0, 10) // Top 10

      setLeaderboard(leaderboardArray)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
      setLoadingLeaderboard(false)
    }
  }

  const handleReportItem = async (e) => {
    e.preventDefault()
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    // ตรวจสอบ network ก่อนทำ transaction
    if (!isCorrectNetwork) {
      alert('Wrong network! Please switch to Base Mainnet.\n\nClick the "Switch to Base" button.')
      if (switchChain) {
        try {
          await switchChain({ chainId: REQUIRED_CHAIN_ID })
        } catch (error) {
          console.error('Failed to switch network:', error)
        }
      }
      return
    }

    if (!formData.bountyAmount || parseFloat(formData.bountyAmount) < 0.0001) {
      alert('Bounty amount must be at least 0.0001 ETH')
      return
    }

    try {
      setLoading(true)
      console.log('Submitting transaction with data:', {
        title: formData.title,
        bountyAmount: formData.bountyAmount,
        contract: CONTRACT_ADDRESS
      })

      const result = writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'reportLostItem',
        args: [
          formData.title,
          formData.description,
          formData.imageUrl || '',
          formData.location,
          formData.category
        ],
        value: parseEther(formData.bountyAmount)
      }, {
        onSuccess: (hash) => {
          console.log('Transaction hash:', hash)
          setTxHash(hash)
          alert('Transaction submitted! Hash: ' + hash + '\n\nPlease wait for confirmation...')

          // รอ 10 วินาทีแล้วรีโหลด
          setTimeout(() => {
            console.log('Reloading items...')
            loadAllData()
            setShowReportModal(false)
            setFormData({
              title: '',
              description: '',
              imageUrl: '',
              location: '',
              category: '',
              bountyAmount: ''
            })
            alert('Item reported successfully!')
          }, 10000)
        },
        onError: (error) => {
          console.error('Transaction error:', error)
          alert('Transaction failed!\n\nError: ' + (error.shortMessage || error.message || 'Transaction rejected'))
          setLoading(false)
        }
      })

      console.log('Write contract result:', result)

    } catch (error) {
      console.error('Error reporting item:', error)
      alert('Failed to report item!\n\nError: ' + (error.shortMessage || error.message || 'Unknown error'))
      setLoading(false)
    }
  }

  const handleClaimItem = async (itemId) => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    if (!claimMessage.trim()) {
      alert('Please provide details about the item')
      return
    }

    try {
      setLoading(true)
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'claimItem',
        args: [itemId, claimMessage]
      })

      alert('Claim submitted successfully!')
      setClaimMessage('')
      setShowDetailModal(false)
      setTimeout(() => loadAllData(), 2000)
    } catch (error) {
      console.error('Error claiming item:', error)
      alert('Failed to submit claim: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancelReport = async (itemId) => {
    if (!canInteract) {
      alert('Please connect to Base Mainnet first')
      return
    }

    if (!confirm('Are you sure you want to cancel this report? You will get your bounty back.')) {
      return
    }

    try {
      setLoading(true)
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'cancelItemReport',
        args: [itemId]
      })

      alert('Report cancelled! Your bounty will be returned.')
      setShowDetailModal(false)
      setTimeout(() => loadAllData(), 2000)
    } catch (error) {
      console.error('Error cancelling report:', error)
      alert('Failed to cancel report: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleIncreaseBounty = async () => {
    if (!canInteract) {
      alert('Please connect to Base Mainnet first')
      return
    }

    if (!increaseBountyAmount || parseFloat(increaseBountyAmount) < 0.0001) {
      alert('Increase amount must be at least 0.0001 ETH')
      return
    }

    try {
      setLoading(true)
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'increaseBounty',
        args: [selectedItemForBounty],
        value: parseEther(increaseBountyAmount)
      })

      alert('Bounty increased successfully!')
      setShowIncreaseBountyModal(false)
      setIncreaseBountyAmount('')
      setTimeout(() => loadAllData(), 2000)
    } catch (error) {
      console.error('Error increasing bounty:', error)
      alert('Failed to increase bounty: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const openIncreaseBountyModal = (itemId) => {
    setSelectedItemForBounty(itemId)
    setShowIncreaseBountyModal(true)
  }

  const filterItems = () => {
    switch (activeTab) {
      case 'my-reports':
        return items.filter(item => item.owner?.toLowerCase() === address?.toLowerCase())
      case 'my-claims':
        return items.filter(item =>
          item.claimants?.some(c => c.toLowerCase() === address?.toLowerCase())
        )
      case 'resolved':
        return items.filter(item => item.isResolved)
      default:
        return items.filter(item => !item.isResolved)
    }
  }

  const openItemDetail = async (item) => {
    try {
      const response = await fetch(`/api/item/${item.id}`)
      if (response.ok) {
        const fullItem = await response.json()
        setSelectedItem(fullItem)
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error('Error loading item details:', error)
    }
  }

  return (
    <div>
      <header className="header">
        <nav className="nav container">
          <div className="logo">
            🔍 Lost & Found Network
          </div>
          <div className="nav-links">
            <ConnectButton />
          </div>
        </nav>
      </header>

      <main className="main-content container">
        {/* Network Warning Banner */}
        {isConnected && !isCorrectNetwork && (
          <div className="network-warning">
            <div className="network-warning-content">
              <div className="network-warning-icon">⚠️</div>
              <div className="network-warning-text">
                <strong>Wrong Network Detected!</strong>
                <br />
                You are currently on {chain?.name || 'Unknown Network'}. Please switch to Base Mainnet to use this application.
              </div>
              <button
                className="btn btn-danger"
                onClick={() => switchChain({ chainId: REQUIRED_CHAIN_ID })}
                style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
              >
                Switch to Base
              </button>
            </div>
          </div>
        )}

        {isConnected && userProfile && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{userProfile.itemsReported}</div>
              <div className="stat-label">Items Reported</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userProfile.itemsFound}</div>
              <div className="stat-label">Items Found</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{Number(userProfile.totalBountyEarned).toFixed(4)} ETH</div>
              <div className="stat-label">Total Earned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userProfile.reputationScore}</div>
              <div className="stat-label">Reputation</div>
            </div>
          </div>
        )}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse Lost Items
          </button>
          <button
            className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 Leaderboard
          </button>
          <button
            className={`tab ${activeTab === 'my-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-reports')}
            disabled={!isConnected}
          >
            My Reports
          </button>
          <button
            className={`tab ${activeTab === 'my-claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-claims')}
            disabled={!isConnected}
          >
            My Claims
          </button>
          <button
            className={`tab ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            Resolved
          </button>
          {canInteract && (
            <button
              className="btn btn-primary"
              onClick={() => setShowReportModal(true)}
              style={{ marginLeft: 'auto' }}
            >
              + Report Lost Item
            </button>
          )}
        </div>

        {activeTab === 'leaderboard' ? (
          <div>
            {loadingLeaderboard ? (
              <div className="loading">Loading leaderboard...</div>
            ) : (
              <div className="leaderboard-container">
                <h2 className="leaderboard-title">🏆 Top Finders</h2>
                <p className="leaderboard-subtitle">Users who have successfully found and returned lost items</p>

                {leaderboard.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🏆</div>
                    <div className="empty-state-text">No finders yet. Be the first to help someone!</div>
                  </div>
                ) : (
                  <div className="leaderboard-list">
                    {leaderboard.map((finder, index) => (
                      <div key={finder.address} className="leaderboard-item">
                        <div className="leaderboard-rank">
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `#${index + 1}`}
                        </div>
                        <div className="leaderboard-info">
                          <div className="leaderboard-address">
                            {finder.address.slice(0, 6)}...{finder.address.slice(-4)}
                          </div>
                          <div className="leaderboard-stats">
                            <span className="stat-pill">
                              📦 {finder.itemsFound} {finder.itemsFound === 1 ? 'item' : 'items'} found
                            </span>
                          </div>
                        </div>
                        <div className="leaderboard-earnings">
                          <div className="earnings-amount">
                            {formatEther(finder.totalEarned)} ETH
                          </div>
                          <div className="earnings-label">Total Earned</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {loading && <div className="loading">Loading...</div>}

            {!loading && (
              <div className="item-grid">
                {filterItems().length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-text">No items found</div>
                  </div>
                ) : (
                  filterItems().map(item => (
                    <div
                      key={item.id}
                      className="item-card"
                      onClick={() => openItemDetail(item)}
                    >
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.title} className="item-image" />
                      )}
                      <div className="item-content">
                        <div className="item-header">
                          <h3 className="item-title">{item.title}</h3>
                          <div className="bounty-badge">
                            {formatEther(item.bountyAmount)} ETH
                          </div>
                        </div>
                        <p className="item-description">{item.description}</p>
                        <div className="item-meta">
                          <span>📍 {item.location}</span>
                          <span>🏷️ {item.category}</span>
                          <span className={`status-badge ${
                            item.isResolved ? 'status-resolved' :
                            item.isClaimed ? 'status-claimed' : 'status-active'
                          }`}>
                            {item.isResolved ? 'Resolved' :
                             item.isClaimed ? 'Claimed' : 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Report Item Modal */}
        {showReportModal && (
          <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Report Lost Item</h2>
                <button className="modal-close" onClick={() => setShowReportModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleReportItem}>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URL (optional)</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://i.imgur.com/example.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                    />
                    <small style={{color: 'var(--gray)', marginTop: '0.5rem', display: 'block'}}>
                      📸 Upload image for free:
                      <a href="https://imgur.com/upload" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)', marginLeft: '0.5rem', textDecoration: 'underline'}}>
                        Imgur
                      </a> |
                      <a href="https://imgbb.com" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)', marginLeft: '0.5rem', textDecoration: 'underline'}}>
                        ImgBB
                      </a> |
                      <a href="https://postimages.org" target="_blank" rel="noopener noreferrer" style={{color: 'var(--primary)', marginLeft: '0.5rem', textDecoration: 'underline'}}>
                        PostImages
                      </a>
                    </small>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      required
                    >
                      <option value="">Select category</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Jewelry">Jewelry</option>
                      <option value="Documents">Documents</option>
                      <option value="Keys">Keys</option>
                      <option value="Bags">Bags</option>
                      <option value="Pets">Pets</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bounty Amount (ETH)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      className="form-input"
                      placeholder="0.0001"
                      value={formData.bountyAmount}
                      onChange={(e) => setFormData({...formData, bountyAmount: e.target.value})}
                      required
                    />
                    <small style={{color: 'var(--gray)', marginTop: '0.5rem', display: 'block'}}>
                      Minimum: 0.0001 ETH
                    </small>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{width: '100%'}}>
                    {loading ? 'Submitting...' : 'Report Item'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Item Detail Modal */}
        {showDetailModal && selectedItem && (
          <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{selectedItem.title}</h2>
                <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                {selectedItem.imageUrl && (
                  <img src={selectedItem.imageUrl} alt={selectedItem.title} style={{width: '100%', borderRadius: '10px', marginBottom: '1rem'}} />
                )}
                <p><strong>Description:</strong> {selectedItem.description}</p>
                <p><strong>Location:</strong> {selectedItem.location}</p>
                <p><strong>Category:</strong> {selectedItem.category}</p>
                <p><strong>Bounty:</strong> {formatEther(selectedItem.bountyAmount)} ETH</p>
                <p><strong>Status:</strong> <span className={`status-badge ${
                  selectedItem.isResolved ? 'status-resolved' :
                  selectedItem.isClaimed ? 'status-claimed' : 'status-active'
                }`}>
                  {selectedItem.isResolved ? 'Resolved' :
                   selectedItem.isClaimed ? 'Claimed' : 'Active'}
                </span></p>

                {/* Owner Actions */}
                {canInteract && !selectedItem.isResolved && selectedItem.owner?.toLowerCase() === address?.toLowerCase() && (
                  <div style={{marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap'}}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => openIncreaseBountyModal(selectedItem.id)}
                      disabled={loading}
                      style={{flex: 1}}
                    >
                      💰 Increase Bounty
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleCancelReport(selectedItem.id)}
                      disabled={loading}
                      style={{flex: 1}}
                    >
                      {loading ? 'Processing...' : '❌ Cancel Report'}
                    </button>
                  </div>
                )}

                {canInteract && !selectedItem.isResolved && selectedItem.owner?.toLowerCase() !== address?.toLowerCase() && (
                  <div style={{marginTop: '1.5rem'}}>
                    <label className="form-label">Claim this item</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Describe the item to prove you found it..."
                      value={claimMessage}
                      onChange={(e) => setClaimMessage(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleClaimItem(selectedItem.id)}
                      disabled={loading}
                      style={{width: '100%', marginTop: '1rem'}}
                    >
                      {loading ? 'Submitting...' : 'Submit Claim'}
                    </button>
                  </div>
                )}

                {selectedItem.claimants && selectedItem.claimants.length > 0 && (
                  <div style={{marginTop: '1.5rem'}}>
                    <h4>Claims ({selectedItem.claimants.length})</h4>
                    <ul className="claimant-list">
                      {selectedItem.claimants.map((claimer, idx) => (
                        <li key={idx} className="claimant-item">
                          <div className="claimant-info">
                            <div className="claimant-address">{claimer}</div>
                            <div className="claimant-message">
                              {selectedItem.claimMessages?.[claimer] || 'No message'}
                            </div>
                          </div>
                          {canInteract && selectedItem.owner?.toLowerCase() === address?.toLowerCase() && !selectedItem.isResolved && (
                            <button
                              className="btn btn-primary"
                              onClick={async () => {
                                try {
                                  await writeContract({
                                    address: CONTRACT_ADDRESS,
                                    abi: CONTRACT_ABI,
                                    functionName: 'confirmFinder',
                                    args: [selectedItem.id, claimer]
                                  })
                                  alert('Finder confirmed!')
                                  setShowDetailModal(false)
                                  setTimeout(() => loadAllData(), 2000)
                                } catch (error) {
                                  alert('Failed to confirm finder')
                                }
                              }}
                            >
                              Confirm
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Increase Bounty Modal */}
        {showIncreaseBountyModal && (
          <div className="modal-overlay" onClick={() => setShowIncreaseBountyModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: '400px'}}>
              <div className="modal-header">
                <h2 className="modal-title">💰 Increase Bounty</h2>
                <button className="modal-close" onClick={() => setShowIncreaseBountyModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p style={{color: 'var(--gray)', marginBottom: '1.5rem'}}>
                  Add more ETH to the bounty to attract more finders. This cannot be refunded if someone claims the item.
                </p>
                <div className="form-group">
                  <label className="form-label">Additional Amount (ETH)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    className="form-input"
                    placeholder="0.0001"
                    value={increaseBountyAmount}
                    onChange={(e) => setIncreaseBountyAmount(e.target.value)}
                    required
                  />
                  <small style={{color: 'var(--gray)', marginTop: '0.5rem', display: 'block'}}>
                    Minimum: 0.0001 ETH
                  </small>
                </div>
                <div style={{display: 'flex', gap: '1rem'}}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setShowIncreaseBountyModal(false)}
                    disabled={loading}
                    style={{flex: 1}}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleIncreaseBounty}
                    disabled={loading}
                    style={{flex: 1}}
                  >
                    {loading ? 'Processing...' : 'Increase Bounty'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
