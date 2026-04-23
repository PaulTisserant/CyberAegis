declare module "node-forge" {
  interface ForgeBuffer {
    getBytes(): string
  }

  interface ForgeCipher {
    start(): void
    update(input: ForgeBuffer): void
    finish(): boolean
    output: ForgeBuffer
  }

  interface ForgeCipherApi {
    createCipher(algorithm: string, key: ForgeBuffer): ForgeCipher
  }

  interface ForgeUtilApi {
    createBuffer(input: string): ForgeBuffer
  }

  interface ForgeApi {
    cipher: ForgeCipherApi
    util: ForgeUtilApi
  }

  const forge: ForgeApi
  export default forge
}
