import { readMockData, writeMockCollection } from './mockResource'
export const targetsApi = {
  async getTargets() { return readMockData().targets || null },
  async updateTargets(changes) {
    const current = readMockData()
    const targets = { ...(current.targets || {}), ...changes }
    writeMockCollection('targets', targets)
    return targets
  },
}
