import { useData } from '../context/DataContext'
export const useProjects = () => useData().data.projects
