import { MessageFormat } from 'messageformat'
import {
  convertToMf2,
  MessagePartsToTree,
  TreeToElements,
} from './messageFormatHelpers'
import type { ReactElement, ReactNode } from 'react'

export default function formatElements(
  value: string,
  elements: ReactElement[] | Record<string, ReactElement> = []
): string | ReactNode[] {
  // Convert message to MF2 syntax
  const message = convertToMf2(value)
  // Create an MF2 formatter
  const mf = new MessageFormat(message)
  // Format the MF2 message to a linear sequence of parts
  const list = mf.formatToParts()
  // Reconstruct the tree of markup tags from the sequence
  const processed = MessagePartsToTree(list)
  // Map markup onto components
  const contents = TreeToElements(processed, elements)
  return contents
}
