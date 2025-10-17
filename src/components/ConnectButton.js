import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { useEffect, useState } from 'react'
import { base } from 'wagmi/chains'

export default function ConnectButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto switch to Base when connected
  useEffect(() => {
    if (isConnected && chain && chain.id !== base.id) {
      switchChain({ chainId: base.id })
    }
  }, [isConnected, chain, switchChain])

  if (!mounted) {
    return (
      <button className="btn btn-primary" disabled>
        Connect Wallet
      </button>
    )
  }

  if (isConnected) {
    const isWrongNetwork = chain && chain.id !== base.id

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isWrongNetwork && (
          <button
            className="btn btn-danger"
            onClick={() => switchChain({ chainId: base.id })}
            style={{ whiteSpace: 'nowrap' }}
          >
            Switch to Base
          </button>
        )}
        <span className="nav-link">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button className="btn btn-outline" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  const handleConnect = () => {
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    }
  }

  return (
    <button
      className="btn btn-primary"
      onClick={handleConnect}
      disabled={connectors.length === 0}
    >
      Connect Wallet
    </button>
  )
}
