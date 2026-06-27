/**
 * Generate pagination data for templates
 * @param {number} currentPage - Current page number
 * @param {number} totalItems - Total number of items
 * @param {number} perPage - Number of items per page
 * @param {number} pageRange - Number of page links to show before and after current page
 * @returns {Object} Pagination data
 */
function getPaginationData(currentPage, totalItems, perPage = 10, pageRange = 2) {
  // Calculate total pages
  const totalPages = Math.ceil(totalItems / perPage);
  
  // Ensure current page is within valid range
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  
  // Calculate start and end page numbers to display
  let startPage = Math.max(1, currentPage - pageRange);
  let endPage = Math.min(totalPages, currentPage + pageRange);
  
  // Adjust if we're near the beginning or end
  if (startPage <= 3) {
    startPage = 1;
    endPage = Math.min(5, totalPages);
  } else if (endPage >= totalPages - 2) {
    startPage = Math.max(1, totalPages - 4);
    endPage = totalPages;
  }
  
  // Generate page numbers to display
  const pages = [];
  
  // Always include first page
  if (startPage > 1) {
    pages.push(1);
    // Add ellipsis if there's a gap
    if (startPage > 2) {
      pages.push('...');
    }
  }
  
  // Add pages in range
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  // Always include last page
  if (endPage < totalPages) {
    // Add ellipsis if there's a gap
    if (endPage < totalPages - 1) {
      pages.push('...');
    }
    pages.push(totalPages);
  }
  
  return {
    currentPage,
    totalPages,
    pages,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    prevPage: currentPage - 1,
    nextPage: currentPage + 1
  };
}

/**
 * Generate pagination data
 * @param {number} currentPage - Current page number
 * @param {number} totalItems - Total number of items
 * @param {number} perPage - Number of items per page
 * @param {number} pageRange - Number of pages to show in pagination
 * @returns {Object} Pagination data
 */
function getPaginationData(currentPage, totalItems, perPage = 20, pageRange = 5) {
  // Calculate total pages
  const totalPages = Math.ceil(totalItems / perPage);
  
  // Ensure current page is within valid range
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  
  // Calculate start and end page numbers to display
  let startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
  let endPage = Math.min(totalPages, startPage + pageRange - 1);
  
  // Adjust start page if end page is at maximum
  if (endPage === totalPages) {
    startPage = Math.max(1, endPage - pageRange + 1);
  }
  
  // Generate array of page numbers to display
  let pages = [];
  
  // Add first page with ellipsis if needed
  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) {
      pages.push('...');
    }
  }
  
  // Add page numbers in range
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  // Add last page with ellipsis if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push('...');
    }
    pages.push(totalPages);
  }
  
  return {
    currentPage,
    totalPages,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    prevPage: currentPage - 1,
    nextPage: currentPage + 1,
    pages
  };
}

module.exports = {
  getPaginationData
};