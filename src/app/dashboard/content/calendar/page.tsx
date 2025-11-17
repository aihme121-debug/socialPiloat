'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { addMonths, endOfMonth, format, startOfMonth, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Plus, Calendar } from 'lucide-react'

interface CalendarEvent {
  id: string
  date: string | Date
  title: string
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED'
  platforms: string[]
  account?: string | null
}

export default function ContentCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [isRescheduling, setIsRescheduling] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const range = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return { start, end }
  }, [currentMonth])

  async function loadEvents() {
    try {
      setLoading(true)
      setError(null)
      const qs = `start=${range.start.toISOString()}&end=${range.end.toISOString()}`
      const res = await fetch(`/api/calendar/events?${qs}`)
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Failed to load calendar')
      }
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [range.start.toISOString(), range.end.toISOString()])

  const days = useMemo(() => {
    const start = range.start
    const end = range.end
    const list: Date[] = []
    let d = new Date(start)
    while (d <= end) {
      list.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }
    return list
  }, [range])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const key = format(new Date(ev.date), 'yyyy-MM-dd')
      const arr = map.get(key) || []
      arr.push(ev)
      map.set(key, arr)
    }
    return map
  }, [events])

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', event.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, date: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault()
    setDragOverDate(null)

    if (!draggedEvent) return

    setIsRescheduling(draggedEvent.id)

    try {
      const targetDateTime = new Date(targetDate)
      const originalDate = new Date(draggedEvent.date)
      
      // Keep the same time of day, just change the date
      targetDateTime.setHours(originalDate.getHours(), originalDate.getMinutes())

      const response = await fetch(`/api/calendar/events/${draggedEvent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduledAt: targetDateTime.toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to reschedule post')
      }

      const data = await response.json()
      
      // Update the local state with the new event data
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === draggedEvent.id 
            ? { ...event, date: data.event.date }
            : event
        )
      )

      toast({
        title: 'Success',
        description: 'Post rescheduled successfully',
      })
    } catch (error) {
      console.error('Failed to reschedule post:', error)
      toast({
        title: 'Error',
        description: 'Failed to reschedule post. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDraggedEvent(null)
      setIsRescheduling(null)
    }
  }, [draggedEvent, toast])

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag and drop posts to reschedule them. Click and drag any post to move it to a different date.
          </p>
        </div>
        <div className="space-x-2">
          <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>Prev</Button>
          <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>Next</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center justify-between">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Published</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span>Draft</span>
          </div>
        </div>
        <Button 
          onClick={() => router.push('/dashboard/content/create')}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Content
        </Button>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
          {loading && <span className="text-sm text-gray-500">Loading…</span>}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
              <div key={dayName} className="text-center text-xs font-semibold text-gray-500 py-2">
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay.get(key) || []
              const isDragOver = dragOverDate === key
              
              return (
                <div 
                  key={key} 
                  className={`border rounded-md p-2 min-h-[120px] bg-white dark:bg-gray-900 transition-colors ${
                    isDragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                >
                  <div className="text-xs font-semibold text-gray-500 mb-2">{format(day, 'dd')}</div>
                  <div className="space-y-2">
                    {dayEvents.map((ev) => (
                      <div 
                        key={ev.id} 
                        className={`rounded-md p-2 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 cursor-move hover:shadow-md transition-all ${
                          isRescheduling === ev.id ? 'opacity-50 scale-95' : ''
                        }`}
                        draggable={isRescheduling !== ev.id}
                        onDragStart={(e) => handleDragStart(e, ev)}
                        title={isRescheduling === ev.id ? 'Rescheduling...' : 'Drag to reschedule'}
                      >
                        <div className="text-xs font-medium truncate">{ev.title}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge 
                            className="text-[10px]" 
                            variant={ev.status === 'PUBLISHED' ? 'default' : ev.status === 'FAILED' ? 'destructive' : 'secondary'}
                          >
                            {isRescheduling === ev.id ? 'Moving...' : ev.status}
                          </Badge>
                          {ev.account && (
                            <Badge className="text-[10px]" variant="outline">{ev.account}</Badge>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {ev.platforms.slice(0, 3).map((platform) => (
                            <Badge key={platform} className="text-[8px]" variant="outline">
                              {platform}
                            </Badge>
                          ))}
                          {ev.platforms.length > 3 && (
                            <Badge className="text-[8px]" variant="outline">
                              +{ev.platforms.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {dayEvents.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">
                        Drop posts here
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}