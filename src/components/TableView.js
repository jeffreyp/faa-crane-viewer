import React, { useState } from 'react';
import styled from 'styled-components';

const TableContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 1rem;
  min-width: 300px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
`;

const TableHeader = styled.th`
  background-color: #f0f0f0;
  padding: 0.5rem;
  text-align: left;
  position: sticky;
  top: 0;
  cursor: pointer;
  
  &:hover {
    background-color: #e0e0e0;
  }
`;

const TableRow = styled.tr`
  cursor: pointer;
  
  &:nth-child(even) {
    background-color: #f8f8f8;
  }
  
  &:hover {
    background-color: #e8f4fd;
  }
  
  ${props => props.selected && `
    background-color: #007acc !important;
    color: white;
    
    &:hover {
      background-color: #005a9e !important;
    }
  `}
`;

const TableCell = styled.td`
  padding: 0.5rem;
  border-bottom: 1px solid #ddd;
`;

const SourceBadge = styled.span`
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;

  ${props => {
    switch(props.source) {
      case 'NOTAM':
        return `
          background-color: #FF8C00;
          color: white;
        `;
      case 'DOF':
        return `
          background-color: #4A90E2;
          color: white;
        `;
      default: // Part77-* sources
        return `
          background-color: #50C878;
          color: white;
        `;
    }
  }}
`;

const EmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #666;
  font-style: italic;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  
  &:after {
    content: " ";
    display: block;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 6px solid #003366;
    border-color: #003366 transparent #003366 transparent;
    animation: spin 1.2s linear infinite;
  }
  
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const TableView = ({ cranes, loading, selectedCraneId, onCraneSelect }) => {
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Sort the cranes array
  const sortedCranes = [...cranes].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });
  
  // Define table columns
  const columns = [
    { field: 'id', label: 'ID' },
    { field: 'structureType', label: 'Type' },
    { field: 'height', label: 'Height (AGL)' },
    { field: 'status', label: 'Status' },
    { field: 'dataSource', label: 'Source' },
    { field: 'startDate', label: 'Start Date' },
    { field: 'endDate', label: 'End Date' },
    { field: 'sponsor', label: 'Sponsor' }
  ];
  
  // Render table content
  const renderContent = () => {
    if (loading) {
      return <LoadingSpinner />;
    }
    
    if (cranes.length === 0) {
      return <EmptyState>No construction cranes found in this area</EmptyState>;
    }
    
    return (
      <Table>
        <thead>
          <tr>
            {columns.map(column => (
              <TableHeader 
                key={column.field}
                onClick={() => handleSort(column.field)}
              >
                {column.label}
                {sortField === column.field && (
                  <span>{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </TableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedCranes.map(crane => (
            <TableRow
              key={crane.uniqueId}
              selected={selectedCraneId === crane.uniqueId}
              onClick={() => onCraneSelect(crane.uniqueId)}
            >
              {columns.map(column => (
                <TableCell key={`${crane.uniqueId}-${column.field}`}>
                  {column.field === 'height'
                    ? `${crane[column.field]} ft`
                    : column.field === 'dataSource'
                    ? <SourceBadge source={crane.dataSource}>{crane.dataSource}</SourceBadge>
                    : crane[column.field]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </tbody>
      </Table>
    );
  };
  
  return (
    <TableContainer>
      <h2>Construction Cranes {cranes.length > 0 ? `(${cranes.length} found)` : ''}</h2>
      {renderContent()}
    </TableContainer>
  );
};

export default TableView;