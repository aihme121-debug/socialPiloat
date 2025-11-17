# SocialPiloat AI - System Restart and Monitoring Solution

## Overview

This comprehensive system restart and monitoring solution provides enterprise-grade reliability for the SocialPiloat AI platform. It includes automatic port management, real-time monitoring, and a professional admin dashboard.

## Features

### 1. Server Port Management
- **Fixed Port Configuration**: Server always runs on port 7070
- **Port Conflict Resolution**: Automatically detects and terminates processes using the target port
- **Graceful Process Termination**: Safely kills conflicting processes before starting the server
- **Automatic ngrok Integration**: Starts ngrok tunnel pointing to port 7070

### 2. Comprehensive Monitoring System

#### Facebook Webhook Monitoring
- Real-time connection status tracking
- Automatic reconnection attempt logging
- Error count and disconnect reason tracking
- API response time monitoring

#### Socket.IO Connection Monitoring
- Live connection count tracking
- Individual connection activity monitoring
- Disconnection reason logging
- Connection retry history

#### ngrok/Server Status Monitoring
- Tunnel establishment status
- Uptime monitoring with automatic restart
- Error condition tracking and resolution
- URL and connection state management

#### Facebook Realtime Data Monitoring
- Data fetch success/failure logging
- API response time tracking
- Error message capture and analysis
- Webhook event processing monitoring

### 3. Developer Admin Dashboard

#### Real-time Status Overview
- System health indicators with color-coded status
- Live connection counts and uptime displays
- Memory usage and performance metrics
- Quick status cards for all services

#### Advanced Log Management
- **Filtering Capabilities**:
  - By category (Facebook, Socket.IO, ngrok, Server, System)
  - By log level (Debug, Info, Warning, Error, Fatal)
  - Full-text search across all log entries
  - Time-based filtering

- **Log Operations**:
  - Export logs to JSON format
  - Clear log history
  - Auto-refresh with configurable intervals
  - Detailed log entry inspection

#### Service-Specific Monitoring
- **Facebook Integration Tab**: Detailed webhook and API status
- **Socket.IO Tab**: Connection management and activity tracking
- **Server Statistics Tab**: Performance metrics and resource usage

### 4. Log Persistence and Rotation

#### Automatic Log Management
- **File-based Storage**: Persistent log storage with JSON Lines format
- **Automatic Rotation**: Logs rotate when reaching 10MB size limit
- **Daily Log Files**: Separate log files for each day
- **Automatic Cleanup**: Keeps only the 10 most recent log files

#### Performance Features
- **Buffered Writing**: Batches log writes for optimal performance
- **Memory Management**: Automatic cleanup of old logs
- **Async Operations**: Non-blocking log persistence
- **Error Recovery**: Graceful handling of write failures

## Installation and Setup

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Windows (for port management features)
- ngrok (optional, for tunneling)

### Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Test the Monitoring System**
   ```bash
   npm run test:monitoring
   ```

3. **Start the Enhanced Server**
   ```bash
   npm run dev:enhanced
   ```

4. **Access the Admin Dashboard**
   Open http://localhost:7070/admin/dashboard

### Available Scripts

```bash
# Development
npm run dev:enhanced          # Start enhanced server with monitoring
npm run dev                   # Start standard Next.js development server

# Testing
npm run test:monitoring       # Run monitoring system tests
npm run health:enhanced       # Check enhanced server health
npm run health:check          # Check standard server health

# Production
npm run build                 # Build the application
npm run start:enhanced        # Start enhanced production server
npm run start                 # Start standard production server
```

## Architecture

### Core Components

#### 1. Port Manager (`src/lib/system/port-manager.ts`)
- Manages port 7070 availability
- Handles process termination
- Provides conflict resolution

#### 2. System Monitor (`src/lib/system/system-monitor.ts`)
- Central monitoring hub
- Real-time status tracking
- Event logging and categorization

#### 3. Log Persistence (`src/lib/system/log-persistence.ts`)
- File-based log storage
- Automatic rotation and cleanup
- Performance optimization

#### 4. Enhanced Server (`server-enhanced.js`)
- Main server with monitoring integration
- Automatic ngrok tunnel management
- Graceful shutdown handling

#### 5. Admin Dashboard (`src/app/admin/dashboard/page.tsx`)
- React-based monitoring interface
- Real-time status updates
- Advanced filtering and search

### Data Flow

1. **Server Startup**: Port manager ensures port 7070 is available
2. **System Events**: All events are captured by system monitor
3. **Log Storage**: Events are persisted with automatic rotation
4. **Dashboard Updates**: Real-time status updates via API endpoints
5. **Health Monitoring**: Continuous system health checks

## API Endpoints

### System Status
```
GET /api/admin/system-status
Returns current system status including all monitored services
```

### System Logs
```
GET /api/admin/system-logs?category=facebook&level=error&limit=100
Returns filtered system logs with optional parameters:
- category: facebook, socket, ngrok, server, system
- level: debug, info, warn, error, fatal
- limit: number of logs to return (default: 100)
- search: text search in log messages
- startTime/endTime: ISO date strings for time filtering
```

### Clear Logs
```
DELETE /api/admin/system-logs
Clears all system logs
```

## Configuration

### Environment Variables
```bash
PORT=7070                    # Server port (fixed at 7070)
NODE_ENV=development         # Environment mode
FACEBOOK_VERIFY_TOKEN=your_token  # Facebook webhook verification
NEXT_PUBLIC_APP_URL=http://localhost:7070  # Application URL
```

### Log Configuration
- **Max File Size**: 10MB per log file
- **Max Files**: 10 log files retained
- **Flush Interval**: 30 seconds
- **Log Directory**: `./logs/`

## Monitoring Best Practices

### 1. Regular Health Checks
- Monitor the admin dashboard daily
- Set up alerts for critical errors
- Review connection trends

### 2. Log Management
- Export logs regularly for analysis
- Monitor disk space usage
- Review error patterns

### 3. Performance Optimization
- Monitor memory usage trends
- Check connection counts
- Review response times

### 4. Troubleshooting
- Use log filtering to isolate issues
- Check service-specific tabs for details
- Review system restart history

## Security Considerations

### Access Control
- Admin dashboard should be protected in production
- Log files contain sensitive information
- API endpoints should require authentication

### Data Protection
- Logs are stored locally by default
- Consider encryption for sensitive data
- Implement log retention policies

## Troubleshooting

### Common Issues

#### Port 7070 Already in Use
```bash
# The system will automatically handle this, but you can check:
netstat -ano | findstr :7070
```

#### ngrok Tunnel Not Starting
- Ensure ngrok is installed: `ngrok --version`
- Check ngrok authentication: `ngrok authtoken`
- Review ngrok logs in system dashboard

#### Dashboard Not Loading
- Verify server is running on port 7070
- Check browser console for JavaScript errors
- Ensure all dependencies are installed

#### Logs Not Appearing
- Check file permissions in `./logs/` directory
- Verify disk space availability
- Review server console for errors

### Performance Issues

#### High Memory Usage
- Monitor memory usage in Server Stats tab
- Check for memory leaks in application code
- Review connection counts and activity

#### Slow Dashboard Loading
- Reduce log limit in API calls
- Implement pagination for large log sets
- Consider log aggregation for long-term storage

## Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review error logs and system health
2. **Monthly**: Clean up old log files and optimize storage
3. **Quarterly**: Update dependencies and security patches

### Monitoring Alerts
Set up alerts for:
- Server downtime
- High error rates
- Memory usage spikes
- Connection failures
- Facebook webhook disconnections

### Backup Strategy
- Regular backup of log files
- Configuration backup
- Database backup (if applicable)

## Conclusion

This comprehensive monitoring solution provides enterprise-grade reliability and visibility for the SocialPiloat AI platform. With automatic port management, real-time monitoring, and a professional admin dashboard, you can ensure optimal system performance and quickly identify and resolve issues.