// Copyright the original author or authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { formatJPY } from '../../../utils/formatters';
import type { StandardMonthlyRemunerationBracket } from '../../../data/employeesHealthInsurance/smrBrackets';

interface SMRTableColumn {
  header: string;
  getValue?: (row: StandardMonthlyRemunerationBracket) => number;
  render?: (row: StandardMonthlyRemunerationBracket) => React.ReactNode;
  align?: 'left' | 'right';
}

interface SMRTableTooltipProps {
  title: string;
  description: string;
  hint?: string;
  tableData: StandardMonthlyRemunerationBracket[];
  columns: SMRTableColumn[];
  currentRow: StandardMonthlyRemunerationBracket | null;
  tableContainerDataAttr: string;
  currentRowId: string;
  getCurrentRowSummary: (row: StandardMonthlyRemunerationBracket) => string;
  officialSourceLink?: {
    url: string;
    text: string;
  };
}

const SMRTableTooltip: React.FC<SMRTableTooltipProps> = ({
  title,
  description,
  hint,
  tableData,
  columns,
  currentRow,
  tableContainerDataAttr,
  currentRowId,
  getCurrentRowSummary,
  officialSourceLink,
}) => {
  // Auto-scroll to the current row when component mounts or income changes
  React.useEffect(() => {
    if (!currentRow) {
      return; // Skip if no current row
    }

    const currentRowElement = document.getElementById(currentRowId);
    const tableContainer = currentRowElement?.closest(`[${tableContainerDataAttr}]`);

    if (currentRowElement && tableContainer) {
      // Use setTimeout to ensure the DOM has been updated
      setTimeout(() => {
        const containerRect = tableContainer.getBoundingClientRect();
        const rowRect = currentRowElement.getBoundingClientRect();

        // Calculate the scroll position relative to the container
        const containerScrollTop = tableContainer.scrollTop;
        const relativeRowTop = rowRect.top - containerRect.top + containerScrollTop;
        const containerHeight = containerRect.height;
        const rowHeight = rowRect.height;

        // Center the row in the container
        const targetScrollTop = relativeRowTop - (containerHeight / 2) + (rowHeight / 2);

        // Smooth scroll within the container only
        tableContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [currentRow, currentRowId, tableContainerDataAttr]);

  if (!tableData || tableData.length === 0) {
    return (
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Premium Table
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Premium table data is not available.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minWidth: { xs: 0, sm: 400 }, maxWidth: { xs: '100vw', sm: 500 } }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, fontSize: '0.85rem' }}>
        {description}
        <br />
        <Typography component="span" sx={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'text.secondary' }}>
          💡 Scroll through the table to view all brackets
        </Typography>
      </Typography>

      <Box
        {...{ [tableContainerDataAttr]: true }} // Dynamic data attribute
        sx={{
          height: '280px', // Fixed height to show ~10 rows
          overflowY: 'auto',
          overscrollBehavior: 'contain', // Prevent scroll chaining
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          mb: 1,
          // Style the scrollbar
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'action.hover',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'action.selected',
            borderRadius: '4px',
            '&:hover': {
              background: 'action.focus',
            },
          },
        }}
        // Prevent wheel events from bubbling to parent when scrolling inside
        onWheel={(e) => {
          e.stopPropagation();
        }}
        // Also prevent touch scroll events from bubbling
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <Box
          component="table"
          sx={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.75rem',
            '& th, & td': {
              border: '1px solid',
              borderColor: 'divider',
              padding: '4px 6px',
              textAlign: 'right',
            },
            '& th': {
              backgroundColor: 'background.paper', // Opaque background for headers
              backdropFilter: 'blur(8px)', // Additional blur effect for better readability
              fontWeight: 600,
              fontSize: '0.7rem',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              boxShadow: '0 1px 0 0 rgba(0,0,0,0.12)', // Subtle shadow to separate from content
            },
            '& td:first-of-type': {
              textAlign: 'left',
            }
          }}
        >
          <Box component="thead">
            <Box component="tr">
              {columns.map((column, index) => (
                <Box
                  key={index}
                  component="th"
                  sx={{ textAlign: column.align === 'left' ? 'left' : 'right' }}
                >
                  {column.header}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {tableData.map((row, index) => {
              const isCurrentRow = currentRow === row;
              return (
                <Box
                  component="tr"
                  key={index}
                  id={isCurrentRow ? currentRowId : undefined}
                  sx={{
                    backgroundColor: isCurrentRow ? 'primary.main' : 'transparent',
                    color: isCurrentRow ? 'primary.contrastText' : 'text.primary',
                    cursor: 'default',
                    transition: 'all 0.3s ease',
                    transform: isCurrentRow ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isCurrentRow ? 2 : 0,
                    '&:hover': {
                      backgroundColor: isCurrentRow ? 'primary.main' : 'action.hover',
                      transform: 'scale(1.01)',
                    },
                    '& td': {
                      borderColor: isCurrentRow ? 'primary.main' : 'divider',
                    }
                  }}
                >
                  {columns.map((column, colIndex) => (
                    <Box
                      key={colIndex}
                      component="td"
                      sx={{ textAlign: column.align === 'left' ? 'left' : 'right' }}
                    >
                      {column.render
                        ? column.render(row)
                        : column.getValue
                          ? formatJPY(column.getValue(row))
                          : null}
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {hint && (
        <>
          <Typography component="span" sx={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'text.secondary' }}>
            {hint}
          </Typography>
        </>
      )}

      {currentRow && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
            {getCurrentRowSummary(currentRow)}
          </Typography>
        </Box>
      )}

      {officialSourceLink && (
        <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            <strong>Official Source:</strong> <a
              href={officialSourceLink.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2', textDecoration: 'underline' }}
            >
              {officialSourceLink.text}
            </a>
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SMRTableTooltip;
