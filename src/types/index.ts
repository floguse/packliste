export interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  email?: string
}

export interface Invitation {
  id: string
  household_id: string
  email?: string
  token: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface TripType {
  id: string
  household_id: string
  name: string
}

export interface Category {
  id: string
  household_id: string
  name: string
  sort_order: number
}

export interface Item {
  id: string
  category_id: string
  household_id: string
  name: string
  sort_order: number
}

export interface Trip {
  id: string
  household_id: string
  name: string
  trip_type_id?: string
  status: 'planning' | 'packing' | 'done'
  created_by: string
  created_at: string
  trip_type?: TripType
}

export interface TripItem {
  id: string
  trip_id: string
  item_id: string
  quantity: number
  packed: boolean
  packed_by?: string
  packed_at?: string
  item?: Item & { category?: Category }
}

export interface PlanningState {
  name: string
  tripTypeId: string
  selectedCategoryIds: string[]
  selectedItems: Record<string, { quantity: number; selected: boolean }>
}
