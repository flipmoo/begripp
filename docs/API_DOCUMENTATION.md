# API Documentatie

Dit document beschrijft de API endpoints die beschikbaar zijn in de applicatie.

## Basis URL

De basis URL voor alle API endpoints is:

```
/api
```

## Authenticatie

De API gebruikt geen authenticatie voor interne endpoints. Voor externe API calls naar Gripp wordt een API key gebruikt die is geconfigureerd in de omgevingsvariabelen.

## Endpoints

### Projecten

#### Alle projecten ophalen

```
GET /api/projects
```

**Query Parameters:**
- `year` (optioneel): Filter projecten op jaar (bijv. `2025`)

**Response:**
```json
[
  {
    "id": 123,
    "name": "Project Naam",
    "number": 1001,
    "color": "#FF5733",
    "archived": false,
    "clientreference": "CLIENT-001",
    "startdate": "2025-01-01T00:00:00.000Z",
    "deadline": "2025-06-30T00:00:00.000Z",
    "company": {
      "id": 456,
      "name": "Bedrijfsnaam"
    },
    "phase": {
      "id": 789,
      "name": "In uitvoering"
    }
  },
  // ...
]
```

#### Project ophalen op ID

```
GET /api/projects/:id
```

**Parameters:**
- `id`: Project ID

**Response:**
```json
{
  "id": 123,
  "name": "Project Naam",
  "number": 1001,
  "color": "#FF5733",
  "archived": false,
  "clientreference": "CLIENT-001",
  "startdate": "2025-01-01T00:00:00.000Z",
  "deadline": "2025-06-30T00:00:00.000Z",
  "company": {
    "id": 456,
    "name": "Bedrijfsnaam"
  },
  "phase": {
    "id": 789,
    "name": "In uitvoering"
  },
  "description": "Project beschrijving",
  "employees": [
    {
      "id": 101,
      "name": "Medewerker Naam"
    }
  ],
  "projectlines": [
    {
      "id": 201,
      "name": "Projectregel",
      "amount": 10,
      "price": 100
    }
  ]
}
```

#### Projecten synchroniseren

```
POST /api/projects/sync
```

**Response:**
```json
{
  "success": true,
  "message": "Projects synchronized successfully",
  "count": 42
}
```

### Medewerkers

#### Alle medewerkers ophalen

```
GET /api/employees
```

**Response:**
```json
[
  {
    "id": 101,
    "name": "Medewerker Naam",
    "email": "medewerker@example.com",
    "function": "Developer",
    "active": true
  },
  // ...
]
```

#### Medewerker ophalen op ID

```
GET /api/employees/:id
```

**Parameters:**
- `id`: Medewerker ID

**Response:**
```json
{
  "id": 101,
  "name": "Medewerker Naam",
  "email": "medewerker@example.com",
  "function": "Developer",
  "active": true,
  "phone": "123-456-7890",
  "address": "Straatnaam 123",
  "city": "Amsterdam",
  "projects": [
    {
      "id": 123,
      "name": "Project Naam"
    }
  ]
}
```

#### Medewerkers synchroniseren

```
POST /api/employees/sync
```

**Response:**
```json
{
  "success": true,
  "message": "Employees synchronized successfully",
  "count": 15
}
```

### Facturen

#### Alle facturen ophalen

```
GET /api/invoices
```

**Query Parameters:**
- `year` (optioneel): Filter facturen op jaar (bijv. `2025`)
- `status` (optioneel): Filter facturen op status (`paid`, `unpaid`, `overdue`)

**Response:**
```json
[
  {
    "id": 301,
    "number": "INV-2025-001",
    "date": "2025-01-15T00:00:00.000Z",
    "duedate": "2025-02-15T00:00:00.000Z",
    "status": "paid",
    "totalinclvat": 1210,
    "totalexclvat": 1000,
    "company": {
      "id": 456,
      "name": "Bedrijfsnaam"
    }
  },
  // ...
]
```

#### Factuur ophalen op ID

```
GET /api/invoices/:id
```

**Parameters:**
- `id`: Factuur ID

**Response:**
```json
{
  "id": 301,
  "number": "INV-2025-001",
  "date": "2025-01-15T00:00:00.000Z",
  "duedate": "2025-02-15T00:00:00.000Z",
  "status": "paid",
  "totalinclvat": 1210,
  "totalexclvat": 1000,
  "company": {
    "id": 456,
    "name": "Bedrijfsnaam"
  },
  "project": {
    "id": 123,
    "name": "Project Naam"
  },
  "lines": [
    {
      "id": 401,
      "description": "Ontwikkeling website",
      "quantity": 10,
      "price": 100,
      "vat": 21
    }
  ]
}
```

#### Facturen synchroniseren

```
POST /api/invoices/sync
```

**Response:**
```json
{
  "success": true,
  "message": "Invoices synchronized successfully",
  "count": 28
}
```

### Bedrijven

#### Alle bedrijven ophalen

```
GET /api/companies
```

**Response:**
```json
[
  {
    "id": 456,
    "name": "Bedrijfsnaam",
    "city": "Amsterdam",
    "country": "Nederland",
    "active": true
  },
  // ...
]
```

#### Bedrijf ophalen op ID

```
GET /api/companies/:id
```

**Parameters:**
- `id`: Bedrijf ID

**Response:**
```json
{
  "id": 456,
  "name": "Bedrijfsnaam",
  "address": "Straatnaam 123",
  "postalcode": "1234 AB",
  "city": "Amsterdam",
  "country": "Nederland",
  "phone": "123-456-7890",
  "email": "info@bedrijf.nl",
  "website": "https://www.bedrijf.nl",
  "active": true,
  "contacts": [
    {
      "id": 501,
      "name": "Contact Persoon",
      "email": "contact@bedrijf.nl",
      "phone": "123-456-7890"
    }
  ],
  "projects": [
    {
      "id": 123,
      "name": "Project Naam"
    }
  ]
}
```

#### Bedrijven synchroniseren

```
POST /api/companies/sync
```

**Response:**
```json
{
  "success": true,
  "message": "Companies synchronized successfully",
  "count": 35
}
```

## Error Responses

Bij een fout retourneert de API een JSON object met een error message:

```json
{
  "error": true,
  "message": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

### HTTP Status Codes

- `200 OK`: Request succesvol
- `400 Bad Request`: Ongeldige request parameters
- `404 Not Found`: Resource niet gevonden
- `500 Internal Server Error`: Server fout

## Rate Limiting

De API heeft rate limiting om overbelasting te voorkomen:

- 100 requests per minuut per IP adres
- Bij overschrijding wordt een `429 Too Many Requests` status geretourneerd

## Caching

De API gebruikt caching om de performance te verbeteren:

- GET requests worden gecached voor 5 minuten
- Cache wordt geïnvalideerd bij POST, PUT en DELETE requests
- Cache headers worden toegevoegd aan responses

## Voorbeelden

### cURL

```bash
# Alle projecten ophalen
curl -X GET "http://localhost:3002/api/projects"

# Project ophalen op ID
curl -X GET "http://localhost:3002/api/projects/123"

# Projecten synchroniseren
curl -X POST "http://localhost:3002/api/projects/sync"
```

### JavaScript (Fetch)

```javascript
// Alle projecten ophalen
fetch('/api/projects')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// Project ophalen op ID
fetch('/api/projects/123')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));

// Projecten synchroniseren
fetch('/api/projects/sync', {
  method: 'POST'
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```
