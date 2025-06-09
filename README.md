# FAA Construction Crane Viewer

A web application that displays construction cranes within a 10 nautical mile radius of a specified location, using mock data simulating the FAA's Obstruction Evaluation/Airport Airspace Analysis (OE/AAA) system.

## Features

- Search for construction cranes near a specific address
- Adjust the search radius (in nautical miles)
- View cranes on an interactive map
- See crane details in a sortable table view
- Responsive design that works on mobile and desktop

## Running the Application

### Local Development

To run the application locally for development:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. The application will open in your browser at http://localhost:3000

### Building for Production

To build the application for production:

```bash
npm run build
```

This will create optimized files in the `public` directory.

## Deployment

This application is configured for deployment to GitHub Pages:

1. Update the `homepage` field in `package.json` with your GitHub username:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/faa-crane-viewer"
   ```

2. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

3. The application will be available at the URL specified in your homepage field

## Implementation Details

This application is built with:

- Vanilla JavaScript for the application logic
- Leaflet for the interactive map
- OpenStreetMap for the map tiles
- Mock data simulating the FAA's OEAAA database

## Data Source

In a production implementation, this application would connect to the FAA's OE/AAA system to retrieve real construction crane data. Currently, it uses mock data for demonstration purposes.

The FAA's OE/AAA system (Obstruction Evaluation/Airport Airspace Analysis) is used to:
- Collect data on proposed construction that might affect navigable airspace
- Evaluate construction notifications required by 14 CFR Part 77
- Track temporary obstructions like construction cranes

## Future Enhancements

- Implement real API integration with the FAA's OEAAA system
- Add geocoding for address searches
- Improve map with additional layers and information
- Add filtering options for the table view
- Enable export of crane data to CSV or other formats