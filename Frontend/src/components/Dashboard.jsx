import { useState } from 'react'
import { useData } from '../context/DataContext'
import {
  currency, dashboardStats, dealFunnel, paymentStatusCounts,
  projectStatusCounts, revenueByService, revenueWindow, servicePerformance, targetMonthPrefix,
} from '../utils/calculations'
import Icon from './Icon'

const ranges = [
  ['5d', 'Last 5 days', 5], ['7d', 'Last 7 days', 7], ['30d', 'Last 30 days', 30],
  ['month', 'This month'], ['previous', 'Previous month'], ['all', 'All time'],
]
const inRange = (value, range, days) => {
  if (!value) return range === 'all'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (range === 'all') return true
  if (range === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  if (range === 'previous') return date.getFullYear() === new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear()
    && date.getMonth() === new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()
  const start = new Date(now)
  start.setDate(now.getDate() - days + 1)
  return date >= start && date <= now
}
function ProgressRing({ value }) {
  const circumference = 2 * Math.PI * 38
  return <div className="ring-wrap"><svg viewBox="0 0 100 100" className="progress-ring" aria-label={`${value}% complete`}><circle cx="50" cy="50" r="38" className="ring-track"/><circle cx="50" cy="50" r="38" className="ring-value" style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - Math.min(value, 100) / 100) }}/></svg><div className="ring-label"><strong>{value}%</strong><span>achieved</span></div></div>
}

function RevenueChart({ data, days, endDate }) {
  const points = revenueWindow(data, days, endDate)
  const max = Math.max(...points.map((point) => point.revenue), 1)
  const width = 640
  const height = 190
  const pad = { left: 42, right: 14, top: 16, bottom: 28 }
  const x = (index) => pad.left + index * (width - pad.left - pad.right) / Math.max(points.length - 1, 1)
  const y = (value) => height - pad.bottom - value / max * (height - pad.top - pad.bottom)
  const path = points.reduce((result, point, index) => {
    if (index === 0) return `M ${x(index)} ${y(point.revenue)}`
    const previous = points[index - 1]
    const middle = (x(index - 1) + x(index)) / 2
    return `${result} Q ${middle} ${y(previous.revenue)} ${middle} ${(y(previous.revenue) + y(point.revenue)) / 2} T ${x(index)} ${y(point.revenue)}`
  }, '')
  return <div className="revenue-line-wrap"><svg className="revenue-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily revenue for the last ${days} days`}>
    {[0, 0.5, 1].map((tick) => <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(max * tick)} y2={y(max * tick)} className="line-grid"/><text x={pad.left - 7} y={y(max * tick) + 3} textAnchor="end" className="line-axis">{currency(max * tick)}</text></g>)}
    <path d={path} className="revenue-path" pathLength="1"/>
    {points.map((point, index) => <g key={point.date}><title>{point.date}: {currency(point.revenue)}</title><circle cx={x(index)} cy={y(point.revenue)} r="4" className="revenue-point"><title>{point.date} · {currency(point.revenue)}</title></circle>{index % Math.max(1, Math.ceil(points.length / 7)) === 0 || index === points.length - 1 ? <text x={x(index)} y={height - 7} textAnchor="middle" className="line-axis">{point.label}</text> : null}</g>)}
  </svg>{points.every((point) => point.revenue === 0) && <div className="chart-empty-overlay">No payments in this date range yet</div>}</div>
}

function DonutChart({ items }) {
  const positive = items.filter((item) => item.revenue > 0)
  const total = positive.reduce((sum, item) => sum + item.revenue, 0)
  if (!total) return <div className="chart-empty">No service revenue recorded yet. Revenue attribution appears when payments are linked to a service, project or deal.</div>
  const colors = ['#5675eb', '#48a98b', '#edaa4f', '#8c71dc', '#ed777b', '#50a9bd', '#758197', '#d178aa']
  const gradient = positive.reduce((state, item, index) => {
    const next = state.position + item.revenue / total * 100
    return { position: next, stops: [...state.stops, `${colors[index % colors.length]} ${state.position}% ${next}%`] }
  }, { position: 0, stops: [] }).stops.join(', ')
  return <div className="donut-content"><div className="revenue-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Revenue share by service"><div><strong>{currency(total)}</strong><span>revenue</span></div></div><div className="donut-legend">{positive.map((item, index) => <div key={item.id}><i style={{ background: colors[index % colors.length] }}/><span>{item.name}</span><b>{Math.round(item.revenue / total * 100)}%</b></div>)}</div></div>
}

function BarList({ items, labelKey, valueKey, format = (value) => value, tone = 'blue' }) {
  const max = Math.max(...items.map((item) => item[valueKey]), 1)
  if (!items.length || items.every((item) => !item[valueKey])) return <div className="chart-empty">No matching records in this period.</div>
  return <div className="analytics-bars">{items.map((item) => <div className="analytics-bar-row" key={item[labelKey]}><span title={item[labelKey]}>{item[labelKey]}</span><div className="analytics-bar-track"><i className={tone} style={{ width: `${Math.max(item[valueKey] / max * 100, 2)}%` }}/></div><b>{format(item[valueKey])}</b></div>)}</div>
}

function ServiceComparisonChart({ items }) {
  const maxClients = Math.max(...items.map((item) => item.clients), 1)
  const maxRevenue = Math.max(...items.map((item) => item.revenue), 1)
  const hasActivity = items.some((item) => item.clients > 0 || item.revenue > 0)

  return <section className="panel service-comparison-panel">
    <div className="panel-heading">
      <div><span className="eyebrow">SERVICE-BY-SERVICE RESULTS</span><h2>Clients and money collected</h2></div>
      <span className="service-chart-period">{items.length} services · {hasActivity ? 'actual records' : 'no activity yet'}</span>
    </div>
    <div className="service-chart-legend"><span><i className="client-bar-key"/>Clients</span><span><i className="revenue-bar-key"/>Collected revenue</span></div>
    <div className="service-comparison-list">{items.map(({ service, clients, revenue }) => <div className="service-comparison-row" key={service.id}>
      <div className="service-comparison-name"><span className="service-comparison-icon"><Icon name={service.icon} size={16}/></span><strong title={service.name}>{service.shortName}</strong></div>
      <div className="service-comparison-metric">
        <div className="service-metric-label"><span>Clients</span><b>{clients}</b></div>
        <div className="service-comparison-track" role="img" aria-label={`${clients} clients`}><i className="client-bar" style={{ width: `${clients ? Math.max(clients / maxClients * 100, 2) : 0}%` }}/></div>
      </div>
      <div className="service-comparison-metric">
        <div className="service-metric-label"><span>Collected</span><b>{currency(revenue)}</b></div>
        <div className="service-comparison-track" role="img" aria-label={`${currency(revenue)} collected`}><i className="revenue-bar" style={{ width: `${revenue > 0 ? Math.max(revenue / maxRevenue * 100, 2) : 0}%` }}/></div>
      </div>
    </div>)}</div>
    {!hasActivity && <p className="service-comparison-empty">Service totals will grow automatically as clients are associated with services and payments are recorded.</p>}
  </section>
}

export default function Dashboard({ navigate, quickAdd }) {
  const { data } = useData()
  const [range, setRange] = useState('5d')
  const [serviceMetric, setServiceMetric] = useState('revenue')
  const currentRange = ranges.find(([key]) => key === range)
  const periodDays = currentRange?.[2] || 5
  const today = new Date()
  const days = range === 'month' ? today.getDate() : range === 'previous' ? new Date(today.getFullYear(), today.getMonth(), 0).getDate() : range === 'all' ? 30 : periodDays
  const chartEndDate = range === 'previous' ? new Date(today.getFullYear(), today.getMonth(), 0) : today
  const stats = dashboardStats(data)
  const targets = data.targets || { clients: 10, revenue: 100000 }
  const monthClients = data.clients.filter((client) => client.createdAt?.startsWith(targetMonthPrefix(data))).length
  const revenueProgress = Math.min(100, Math.round(stats.monthRevenue / Math.max(Number(targets.revenue), 1) * 100))
  const clientProgress = Math.min(100, Math.round(monthClients / Math.max(Number(targets.clients), 1) * 100))
  const filteredPayments = range === 'all' ? data.payments : data.payments.filter((payment) => inRange(payment.date, range, days))
  const filteredData = (() => {
    if (range === 'all') return data
    const eligibleProjectIds = new Set(data.projects.filter((project) => inRange(project.createdAt || project.startDate, range, days)).map((project) => project.id))
    const eligibleDealIds = new Set(data.deals.filter((deal) => inRange(deal.createdAt || deal.expectedCloseDate, range, days)).map((deal) => deal.id))
    return {
      ...data,
      clients: data.clients.filter((client) => inRange(client.createdAt, range, days)),
      payments: filteredPayments,
      projects: data.projects.filter((project) => eligibleProjectIds.has(project.id)),
      deals: data.deals.filter((deal) => eligibleDealIds.has(deal.id)),
      leads: data.leads.filter((lead) => inRange(lead.createdAt, range, days)),
    }
  })()
  const serviceRows = servicePerformance(filteredData).sort((a, b) => b[serviceMetric] - a[serviceMetric])
  const plottedRevenue = revenueWindow({ ...data, payments: filteredPayments }, days, chartEndDate)
  const dailyTotal = plottedRevenue.reduce((sum, point) => sum + point.revenue, 0)
  const cards = [
    ['Total clients', stats.clients, 'Across the workspace', 'users', 'violet', 'clients', Math.min(100, stats.clients / Math.max(Number(targets.clients), 1) * 100)],
    ['Active clients', stats.activeClients, 'Current relationships', 'users', 'blue', 'clients', stats.clients ? stats.activeClients / stats.clients * 100 : 0],
    ['New leads', stats.newLeads, 'Not yet converted or lost', 'user', 'amber', 'leads', Math.min(100, stats.newLeads / Math.max(Number(targets.leads || 100), 1) * 100)],
    ['Active projects', stats.activeProjects, 'In progress or on hold', 'briefcase', 'blue', 'projects', Math.min(100, stats.activeProjects / Math.max(Number(targets.projects || 15), 1) * 100)],
    ['Completed projects', stats.completed, 'Delivered work', 'check', 'green', 'projects', Math.min(100, stats.completed / Math.max(Number(targets.projects || 15), 1) * 100)],
    ['Total deals', stats.deals, `${stats.acceptedDeals} accepted`, 'briefcase', 'violet', 'deals', stats.deals ? stats.acceptedDeals / stats.deals * 100 : 0],
    ['Total revenue', currency(stats.bookedRevenue), 'Agreed value of contracted work', 'trend', 'green', 'deals', stats.totalDealValue ? stats.bookedRevenue / stats.totalDealValue * 100 : 0],
    ['Amount collected', currency(stats.totalPaid), 'Across all client work', 'card', 'blue', 'payments', stats.bookedRevenue ? Math.min(100, stats.totalPaid / stats.bookedRevenue * 100) : 0],
    ['Outstanding balance', currency(stats.pending), 'Remaining on active agreements', 'clock', 'amber', 'payments', stats.bookedRevenue ? Math.min(100, stats.pending / stats.bookedRevenue * 100) : 0],
    ['Revenue this month', currency(stats.monthRevenue), 'Collected in the current month', 'chart', 'violet', 'payments', revenueProgress],
  ]
  const activities = data.activities.slice(0, 6)
  return <div className="page-stack">
    <section className="welcome-row"><div><div className="eyebrow">{today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit' }).toUpperCase()} <span className="live-dot"/></div><h1>Your business, <em>in motion.</em></h1><p>A connected view of MAGAF's clients, delivery and momentum.</p></div><button className="button button-primary" onClick={() => quickAdd('leads')}><Icon name="plus" size={17}/> Add a lead</button></section>
    <div className="quick-actions">{[['leads','Add lead','user'],['clients','Add client','users'],['projects','New project','briefcase'],['payments','Record payment','card'],['assets','Add creative asset','sparkles']].map(([type,label,icon])=><button className="quick-action" key={type} onClick={() => quickAdd(type)}><span className="quick-icon"><Icon name={icon}/></span><span>{label}</span><Icon name="arrow" size={15}/></button>)}</div>
    <section className="kpi-grid">{cards.map(([label, value, sub, icon, tint, route, progress]) => <button className="kpi-card" onClick={() => navigate(route)} key={label}><div className="kpi-top"><span className={`kpi-icon ${tint}`}><Icon name={icon}/></span><span className="kpi-more"><Icon name="more"/></span></div><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong><span className="kpi-progress" aria-label={`${Math.round(progress)}% progress`}><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></span><span className="kpi-foot">{sub}</span></button>)}</section>
    <div className="dashboard-grid">
      <section className="panel analytics-panel"><div className="panel-heading"><div><span className="eyebrow">PAYMENT LEDGER · ACTUAL TRANSACTIONS</span><h2>Daily revenue</h2></div><select className="analytics-select" aria-label="Revenue date range" value={range} onChange={(event) => setRange(event.target.value)}>{ranges.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div className="analytics-total"><strong>{currency(dailyTotal)}</strong><span>{range === 'all' ? 'Recent 30 days · daily view' : `${currentRange?.[1]} · daily total`}</span></div><RevenueChart data={{ ...data, payments: filteredPayments }} days={days} endDate={chartEndDate}/></section>
      <section className="panel target-panel"><div className="panel-heading"><div><span className="eyebrow">{targets.month || 'MONTHLY TARGETS'}</span><h2>Growth targets</h2></div><button className="text-action" onClick={() => navigate('targets')}>Manage <Icon name="arrow" size={14}/></button></div><div className="target-item"><ProgressRing value={clientProgress}/><div className="target-copy"><span>Client acquisition</span><strong>{monthClients}<small> / {targets.clients} clients</small></strong><span className="target-remaining">{Math.max(Number(targets.clients) - monthClients, 0)} to go this month</span></div></div><div className="target-divider"/><div className="target-item"><ProgressRing value={revenueProgress}/><div className="target-copy"><span>Revenue collected</span><strong>{currency(stats.monthRevenue)}<small> / {currency(targets.revenue)}</small></strong><span className="target-remaining">{currency(Math.max(Number(targets.revenue) - stats.monthRevenue, 0))} remaining</span></div></div></section>
    </div>
    <ServiceComparisonChart items={serviceRows}/>
    <div className="dashboard-grid analytics-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SERVICE MIX</span><h2>Service performance</h2></div><select className="analytics-select" value={serviceMetric} onChange={(event) => setServiceMetric(event.target.value)} aria-label="Service performance metric"><option value="revenue">Revenue</option><option value="clients">Clients</option><option value="projects">Projects</option></select></div><BarList items={serviceRows.map((item) => ({ name: item.service.shortName, value: item[serviceMetric] }))} labelKey="name" valueKey="value" format={serviceMetric === 'revenue' ? currency : (value) => value}/></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">REVENUE SHARE</span><h2>Revenue by service</h2></div></div><DonutChart items={revenueByService(filteredData)}/></section>
    </div>
    <div className="dashboard-grid analytics-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">DELIVERY PIPELINE</span><h2>Project status</h2></div></div><BarList items={projectStatusCounts(filteredData).map((item) => ({ name: item.status, value: item.count }))} labelKey="name" valueKey="value" tone="green"/></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SALES PIPELINE</span><h2>Deal funnel</h2></div></div><div className="funnel-list">{dealFunnel(filteredData).map((item, index) => <div className="funnel-row" key={item.stage}><span>{item.stage}</span><div><i style={{ width: `${Math.max(item.count / Math.max(...dealFunnel(filteredData).map((stage) => stage.count), 1) * 100, item.count ? 8 : 0)}%` }}/></div><b>{item.count}</b>{index < 6 && <small>↓</small>}</div>)}</div></section>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">COLLECTION HEALTH</span><h2>Payment status</h2></div><button className="text-action" onClick={() => navigate('payments')}>View payments <Icon name="arrow" size={14}/></button></div><div className="payment-status-grid">{paymentStatusCounts(data).map((item) => <div className="payment-status-card" key={item.status}><strong>{item.count}</strong><span>{item.status}</span></div>)}</div></section>
      <section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">THE LATEST</span><h2>Recent activity</h2></div><button className="text-action" onClick={() => navigate('reports')}>All activity <Icon name="arrow" size={14}/></button></div><div className="activity-list">{activities.map((activity) => <button className="activity-row" key={activity.id} onClick={() => navigate(activity.type === 'payment' ? 'payments' : `${activity.type === 'lead' ? 'leads' : activity.type === 'client' ? 'clients' : activity.type === 'deal' ? 'deals' : 'projects'}/${activity.recordId}`)}><span className={`activity-mark ${activity.type}`}><Icon name={activity.type === 'payment' ? 'card' : activity.type === 'lead' ? 'user' : activity.type === 'client' ? 'users' : 'briefcase'} size={15}/></span><span className="activity-copy"><strong>{activity.title}</strong><small>{activity.detail}</small></span><time>{activity.time?.split(',')[0] || 'Recently'}</time></button>)}{!activities.length && <div className="chart-empty">New activity will appear here as the team updates records.</div>}</div></section>
    </div>
  </div>
}
