import type { FC } from 'react'

import { JwtDecoder } from './JwtDecoder'
import { Base64Tool } from './Base64Tool'
import { UrlEncoderDecoder } from './UrlEncoderDecoder'
import { HtmlEntityTool } from './HtmlEntityTool'
import { JsonFormatter } from './JsonFormatter'
import { JsonDiff } from './JsonDiff'
import { XmlJsonConverter } from './XmlJsonConverter'
import { YamlJsonConverter } from './YamlJsonConverter'
import { JsonToXlsxConverter } from './JsonToXlsxConverter'
import { UuidGenerator } from './UuidGenerator'
import { HashGenerator } from './HashGenerator'
import { PasswordGenerator } from './PasswordGenerator'
import { LoremIpsumGenerator } from './LoremIpsumGenerator'
import { UnixTimestampConverter } from './UnixTimestampConverter'
import { TimezoneConverter } from './TimezoneConverter'
import { RegexTester } from './RegexTester'
import { StringCaseConverter } from './StringCaseConverter'
import { TextDiff } from './TextDiff'
import { TextStats } from './TextStats'
import { HttpStatusCodes } from './HttpStatusCodes'
import { CurlToCode } from './CurlToCode'

export const toolComponents: Record<string, FC> = {
  'jwt-decoder': JwtDecoder,
  'base64': Base64Tool,
  'url-encoder': UrlEncoderDecoder,
  'html-entity': HtmlEntityTool,
  'json-formatter': JsonFormatter,
  'json-diff': JsonDiff,
  'xml-json': XmlJsonConverter,
  'yaml-json': YamlJsonConverter,
  'json-xlsx': JsonToXlsxConverter,
  'uuid-generator': UuidGenerator,
  'hash-generator': HashGenerator,
  'password-generator': PasswordGenerator,
  'lorem-ipsum': LoremIpsumGenerator,
  'unix-timestamp': UnixTimestampConverter,
  'timezone-converter': TimezoneConverter,
  'regex-tester': RegexTester,
  'string-case': StringCaseConverter,
  'text-diff': TextDiff,
  'text-stats': TextStats,
  'http-status': HttpStatusCodes,
  'curl-to-code': CurlToCode,
}
