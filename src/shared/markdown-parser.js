import { SECTION_HEADER, TABLE_HEADER } from './constants.js';

/**
 * Parse a pipe-delimited table row into an array of cell strings.
 * Handles escaped pipes within cells by not splitting on escaped `\|`.
 * @param {string} line
 * @returns {string[]}
 */
function splitRow(line) {
  // Strip leading/trailing pipes, then split on unescaped pipes
  const trimmed = line.replace(/^\||\|$/g, '');
  // Split on | not preceded by backslash
  return trimmed.split(/(?<!\\)\|/).map(cell => cell.trim());
}

/**
 * Parse the VocabVault section from raw markdown.
 * @param {string} rawMarkdown
 * @returns {{word: string, reading: string, definition: string}[]}
 */
export function parseEntries(rawMarkdown) {
  const sectionStart = rawMarkdown.indexOf(SECTION_HEADER);
  if (sectionStart === -1) return [];

  // Content after the section header line
  const afterHeader = rawMarkdown.slice(sectionStart + SECTION_HEADER.length);

  // Find the end of this section (next ## heading or EOF)
  const nextSectionMatch = afterHeader.match(/\n## /);
  const sectionContent = nextSectionMatch
    ? afterHeader.slice(0, nextSectionMatch.index)
    : afterHeader;

  const entries = [];
  const lines = sectionContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Must look like a table row
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = splitRow(trimmed);
    if (cells.length < 3) continue;
    // Skip header and separator rows
    if (cells[0].toLowerCase() === 'word') continue;
    if (/^[-\s]+$/.test(cells[0])) continue;

    entries.push({
      word: cells[0],
      reading: cells[1],
      definition: cells[2],
    });
  }

  return entries;
}

/**
 * Serialize a single entry as a markdown table row.
 * @param {{word: string, reading: string, definition: string}} entry
 * @returns {string}
 */
export function serializeEntry(entry) {
  return `| ${entry.word} | ${entry.reading} | ${entry.definition} |`;
}

/**
 * Serialize all entries as a full table (header + rows).
 * @param {{word: string, reading: string, definition: string}[]} entries
 * @returns {string}
 */
export function serializeTable(entries) {
  const rows = entries.map(serializeEntry).join('\n');
  return rows.length > 0 ? `${TABLE_HEADER}\n${rows}` : TABLE_HEADER;
}

/**
 * Rewrite only the VocabVault section in rawMarkdown with the given entries.
 * Preserves everything before the section. If the section doesn't exist, appends it.
 * @param {string} rawMarkdown
 * @param {{word: string, reading: string, definition: string}[]} entries
 * @returns {string}
 */
export function rewriteSection(rawMarkdown, entries) {
  const table = serializeTable(entries);
  const newSection = `${SECTION_HEADER}\n${table}`;

  const sectionStart = rawMarkdown.indexOf(SECTION_HEADER);
  if (sectionStart === -1) {
    // Append to end, ensuring a blank line separator
    const separator = rawMarkdown.endsWith('\n') ? '\n' : '\n\n';
    return rawMarkdown + separator + newSection + '\n';
  }

  const before = rawMarkdown.slice(0, sectionStart);
  const afterHeader = rawMarkdown.slice(sectionStart + SECTION_HEADER.length);

  // Find next ## section
  const nextSectionMatch = afterHeader.match(/\n## /);
  const sectionBody = nextSectionMatch
    ? afterHeader.slice(0, nextSectionMatch.index)
    : afterHeader;
  const afterSection = nextSectionMatch
    ? afterHeader.slice(nextSectionMatch.index)
    : '';

  const tableStart = sectionBody.indexOf(TABLE_HEADER);
  if (tableStart === -1) {
    const trimmedBody = sectionBody.replace(/^\n+/, '').replace(/\s+$/, '');
    const bodySuffix = trimmedBody ? `\n${trimmedBody}` : '';
    return `${before}${SECTION_HEADER}\n${table}${bodySuffix}${afterSection}`;
  }

  const beforeTable = sectionBody.slice(0, tableStart).replace(/^\n+/, '').replace(/\s+$/, '');
  const afterTableBody = sectionBody.slice(tableStart + TABLE_HEADER.length);
  const tableLines = afterTableBody.split('\n');
  let tableEndOffset = 0;

  for (const line of tableLines) {
    if (!line.trim()) {
      tableEndOffset += line.length + 1;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableEndOffset += line.length + 1;
      continue;
    }

    break;
  }

  const afterTable = afterTableBody.slice(tableEndOffset).replace(/^\n+/, '');
  const prefix = beforeTable ? `\n${beforeTable}` : '';
  const suffix = afterTable ? `\n${afterTable}` : '';
  return `${before}${SECTION_HEADER}${prefix}\n${table}${suffix}${afterSection}`;
}
