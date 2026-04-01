interface RPCAccessor {
  request: {
    [key: string]: (params: any) => Promise<any>
  }
  send: {
    [key: string]: (params: any) => void
  }
}

function getElectroview(): { rpc: RPCAccessor } {
  return (window as any).__electrobun
}

export function rpc() {
  return getElectroview().rpc
}
