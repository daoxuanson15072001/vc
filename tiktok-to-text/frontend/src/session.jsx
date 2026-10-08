import { createContext, useContext } from 'react'

export const SessionContext = createContext({ user: null })
export const useSession = () => useContext(SessionContext)
