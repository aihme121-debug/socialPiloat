import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ContentCalendarPage from '@/app/dashboard/content/calendar/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock the fetch API to return successful response
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ events: [] }),
  text: async () => JSON.stringify({ events: [] }),
})

describe('ContentCalendarPage', () => {
  it('should render calendar page with basic structure', async () => {
    render(<ContentCalendarPage />)

    // Wait for the component to load
    await waitFor(() => {
      expect(screen.getByText('Content Calendar')).toBeInTheDocument()
    })
    
    // Check for basic elements - use getByText with function for partial match
    expect(screen.getByText((content, element) => {
      return content.includes('Drag and drop posts to reschedule them')
    })).toBeInTheDocument()
    expect(screen.getByText('Create Content')).toBeInTheDocument()
  })

  it('should render navigation buttons', async () => {
    render(<ContentCalendarPage />)

    await waitFor(() => {
      expect(screen.getByText('Content Calendar')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Prev')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('should render status legend', async () => {
    render(<ContentCalendarPage />)

    await waitFor(() => {
      expect(screen.getByText('Content Calendar')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Scheduled')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('should render day labels', async () => {
    render(<ContentCalendarPage />)

    await waitFor(() => {
      expect(screen.getByText('Content Calendar')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('should show loading state initially', async () => {
    render(<ContentCalendarPage />)

    // Should show loading indicator initially
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('should handle empty calendar state', async () => {
    render(<ContentCalendarPage />)

    await waitFor(() => {
      expect(screen.getByText('Content Calendar')).toBeInTheDocument()
    })
    
    // Should show empty calendar with drop zones
    const dropZones = screen.getAllByText('Drop posts here')
    expect(dropZones.length).toBeGreaterThan(0)
  })
})