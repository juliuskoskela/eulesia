import type { User } from '../types'

export const users: User[] = [
  // Institutions
  {
    id: 'tampere-municipality',
    name: 'City of Tampere',
    role: 'institution',
    verified: true,
    municipality: 'tampere',
    avatarInitials: 'TRE',
    institutionType: 'municipality',
    institutionName: 'City of Tampere'
  },
  {
    id: 'helsinki-municipality',
    name: 'City of Helsinki',
    role: 'institution',
    verified: true,
    municipality: 'helsinki',
    avatarInitials: 'HKI',
    institutionType: 'municipality',
    institutionName: 'City of Helsinki'
  },
  {
    id: 'traficom',
    name: 'Finnish Transport and Communications Agency',
    role: 'institution',
    verified: true,
    avatarInitials: 'TRA',
    institutionType: 'agency',
    institutionName: 'Traficom'
  },
  {
    id: 'ministry-environment',
    name: 'Ministry of the Environment',
    role: 'institution',
    verified: true,
    avatarInitials: 'YM',
    institutionType: 'ministry',
    institutionName: 'Ministry of the Environment'
  },
  // Citizens
  {
    id: 'matti-virtanen',
    name: 'Matti Virtanen',
    role: 'citizen',
    verified: true,
    municipality: 'tampere',
    avatarInitials: 'MV'
  },
  {
    id: 'anna-korhonen',
    name: 'Anna Korhonen',
    role: 'citizen',
    verified: true,
    municipality: 'tampere',
    avatarInitials: 'AK'
  },
  {
    id: 'liisa-makinen',
    name: 'Liisa Mäkinen',
    role: 'citizen',
    verified: true,
    municipality: 'tampere',
    avatarInitials: 'LM'
  },
  {
    id: 'juha-nieminen',
    name: 'Juha Nieminen',
    role: 'citizen',
    verified: true,
    municipality: 'helsinki',
    avatarInitials: 'JN'
  },
  {
    id: 'maria-lahtinen',
    name: 'Maria Lahtinen',
    role: 'citizen',
    verified: true,
    municipality: 'tampere',
    avatarInitials: 'ML'
  },
  {
    id: 'current-user',
    name: 'Demo User',
    role: 'citizen',
    verified: true,
    municipality: 'tampere',
    avatarInitials: 'DU'
  }
]

export const getUserById = (id: string): User | undefined => {
  return users.find(user => user.id === id)
}

export const getInstitutions = (): User[] => {
  return users.filter(user => user.role === 'institution')
}

export const getCitizens = (): User[] => {
  return users.filter(user => user.role === 'citizen')
}
