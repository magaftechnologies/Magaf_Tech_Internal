const capabilities = {
  software: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
  automation: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
  creative: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
  content: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
  events: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
  mentoring: { supportsProjects: false, supportsStudents: true, supportsPayments: true, supportsFiles: true, supportsRequests: false },
  custom: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
  products: { supportsProjects: true, supportsStudents: false, supportsPayments: true, supportsFiles: true, supportsRequests: true },
}

export const getServiceCapabilities = (serviceId) => ({
  supportsProjects: true,
  supportsStudents: false,
  supportsPayments: true,
  supportsFiles: true,
  supportsRequests: true,
  ...capabilities[serviceId],
})

export const enrichServices = (records, date = new Date().toISOString().slice(0, 10)) => records.map((service) => ({
  ...service,
  status: service.status || 'Active',
  createdAt: service.createdAt || date,
  updatedAt: service.updatedAt || date,
  ...getServiceCapabilities(service.id),
}))
