export interface JobLocationFilterOption {
  value: string
  label: string
  labelEn: string
  keywords: string[]
  exactValues: string[]
  parentValue?: string
}

export interface JobLocationGroup extends JobLocationFilterOption {
  key: string
  children: JobLocationFilterOption[]
}

export const JOB_LOCATION_TAXONOMY: JobLocationGroup[]
export const JOB_LOCATION_FILTER_OPTIONS: JobLocationFilterOption[]
export const JOB_LOCATION_ADMIN_QUICK_TAGS: string[]

export function getJobLocationFilterOption(value: unknown): JobLocationFilterOption | null
export function getJobLocationParentValue(value: unknown): string | null
export function matchesJobLocationFilter(location: unknown, filterValue: unknown): boolean
export function buildJobLocationAvailability(locations: unknown[]): Array<{ value: string; count: number }>
