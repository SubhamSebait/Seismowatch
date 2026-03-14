import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:5000/api' })

export const getStats       = ()           => api.get('/earthquakes/stats')
export const getEarthquakes = (params)     => api.get('/earthquakes', { params })
export const getHeatmap     = (minYear)    => api.get(`/earthquakes/heatmap?minYear=${minYear}`)
export const getRecent      = ()           => api.get('/earthquakes/recent')
export const getCities      = ()           => api.get('/cities')
export const getCity        = (name)       => api.get(`/cities/${name}`)
export const getMap         = ()           => api.get('/map')
export const predictCity    = (name)       => api.get(`/predict/city/${name}`)
export const predictLatLng  = (lat, lng)   => api.post('/predict', { lat, lng })
export const getModelInfo   = ()           => api.get('/predict/model-info')

export default api