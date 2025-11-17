import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

describe('UI Components - Extended Tests', () => {
  describe('Alert Component', () => {
    it('should render alert with all variants', () => {
      const { rerender } = render(
        <Alert>
          <AlertTitle>Default Alert</AlertTitle>
          <AlertDescription>This is a default alert</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByText('Default Alert')).toBeInTheDocument()
      expect(screen.getByText('This is a default alert')).toBeInTheDocument()

      // Test destructive variant
      rerender(
        <Alert variant="destructive">
          <AlertTitle>Error Alert</AlertTitle>
          <AlertDescription>This is an error alert</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByText('Error Alert')).toBeInTheDocument()
    })

    it('should handle alert without title', () => {
      render(
        <Alert>
          <AlertDescription>Alert without title</AlertDescription>
        </Alert>
      )
      
      expect(screen.getByText('Alert without title')).toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
  })

  describe('Badge Component', () => {
    it('should render badge with all variants', () => {
      const { rerender } = render(<Badge>Default Badge</Badge>)
      expect(screen.getByText('Default Badge')).toBeInTheDocument()

      // Test secondary variant
      rerender(<Badge variant="secondary">Secondary Badge</Badge>)
      expect(screen.getByText('Secondary Badge')).toBeInTheDocument()

      // Test destructive variant
      rerender(<Badge variant="destructive">Destructive Badge</Badge>)
      expect(screen.getByText('Destructive Badge')).toBeInTheDocument()

      // Test outline variant
      rerender(<Badge variant="outline">Outline Badge</Badge>)
      expect(screen.getByText('Outline Badge')).toBeInTheDocument()
    })

    it('should handle badge without children', () => {
      const { container } = render(<Badge />)
      // Should render without errors - just check that the div exists
      const badgeElement = container.querySelector('div')
      expect(badgeElement).toBeInTheDocument()
      expect(badgeElement?.tagName).toBe('DIV')
    })
  })
})