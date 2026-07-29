local SpetlyJson = {}

local escapes = {
  ['"'] = '\\"',
  ["\\"] = "\\\\",
  ["\b"] = "\\b",
  ["\f"] = "\\f",
  ["\n"] = "\\n",
  ["\r"] = "\\r",
  ["\t"] = "\\t",
}

local function encodeString(value)
  return '"' .. tostring(value):gsub('[%z\1-\31\\"]', function(char)
    return escapes[char] or string.format("\\u%04x", string.byte(char))
  end) .. '"'
end

local function isArray(value)
  local count = 0

  for key, _ in pairs(value) do
    if type(key) ~= "number" then
      return false
    end

    if key > count then
      count = key
    end
  end

  for index = 1, count do
    if value[index] == nil then
      return false
    end
  end

  return true
end

local function encodeValue(value)
  local valueType = type(value)

  if value == nil then
    return "null"
  end

  if valueType == "string" then
    return encodeString(value)
  end

  if valueType == "number" then
    return tostring(value)
  end

  if valueType == "boolean" then
    return value and "true" or "false"
  end

  if valueType == "table" then
    local parts = {}

    if isArray(value) then
      for index = 1, #value do
        parts[#parts + 1] = encodeValue(value[index])
      end

      return "[" .. table.concat(parts, ",") .. "]"
    end

    for key, entry in pairs(value) do
      if type(key) == "string" then
        parts[#parts + 1] = encodeString(key) .. ":" .. encodeValue(entry)
      end
    end

    return "{" .. table.concat(parts, ",") .. "}"
  end

  return "null"
end

function SpetlyJson.encode(value)
  return encodeValue(value)
end

local Parser = {}
Parser.__index = Parser

function Parser:new(text)
  return setmetatable({ text = text or "", index = 1 }, self)
end

function Parser:peek()
  return self.text:sub(self.index, self.index)
end

function Parser:next()
  local char = self:peek()
  self.index = self.index + 1
  return char
end

function Parser:skipWhitespace()
  while self:peek():match("%s") do
    self.index = self.index + 1
  end
end

function Parser:parseString()
  local result = {}

  self:next()

  while self.index <= #self.text do
    local char = self:next()

    if char == '"' then
      return table.concat(result)
    end

    if char == "\\" then
      local escaped = self:next()

      if escaped == '"' or escaped == "\\" or escaped == "/" then
        result[#result + 1] = escaped
      elseif escaped == "b" then
        result[#result + 1] = "\b"
      elseif escaped == "f" then
        result[#result + 1] = "\f"
      elseif escaped == "n" then
        result[#result + 1] = "\n"
      elseif escaped == "r" then
        result[#result + 1] = "\r"
      elseif escaped == "t" then
        result[#result + 1] = "\t"
      elseif escaped == "u" then
        result[#result + 1] = "?"
        self.index = self.index + 4
      end
    else
      result[#result + 1] = char
    end
  end

  error("Invalid JSON string")
end

function Parser:parseNumber()
  local startIndex = self.index

  while self:peek():match("[%d%+%-%.eE]") do
    self.index = self.index + 1
  end

  return tonumber(self.text:sub(startIndex, self.index - 1))
end

function Parser:parseLiteral(literal, value)
  if self.text:sub(self.index, self.index + #literal - 1) ~= literal then
    error("Invalid JSON literal")
  end

  self.index = self.index + #literal
  return value
end

function Parser:parseArray()
  local result = {}

  self:next()
  self:skipWhitespace()

  if self:peek() == "]" then
    self:next()
    return result
  end

  while true do
    result[#result + 1] = self:parseValue()
    self:skipWhitespace()

    local char = self:next()

    if char == "]" then
      return result
    end

    if char ~= "," then
      error("Invalid JSON array")
    end
  end
end

function Parser:parseObject()
  local result = {}

  self:next()
  self:skipWhitespace()

  if self:peek() == "}" then
    self:next()
    return result
  end

  while true do
    self:skipWhitespace()

    if self:peek() ~= '"' then
      error("Invalid JSON object key")
    end

    local key = self:parseString()
    self:skipWhitespace()

    if self:next() ~= ":" then
      error("Invalid JSON object")
    end

    result[key] = self:parseValue()
    self:skipWhitespace()

    local char = self:next()

    if char == "}" then
      return result
    end

    if char ~= "," then
      error("Invalid JSON object")
    end
  end
end

function Parser:parseValue()
  self:skipWhitespace()

  local char = self:peek()

  if char == '"' then
    return self:parseString()
  end

  if char == "{" then
    return self:parseObject()
  end

  if char == "[" then
    return self:parseArray()
  end

  if char == "t" then
    return self:parseLiteral("true", true)
  end

  if char == "f" then
    return self:parseLiteral("false", false)
  end

  if char == "n" then
    return self:parseLiteral("null", nil)
  end

  return self:parseNumber()
end

function SpetlyJson.decode(text)
  local parser = Parser:new(text)
  return parser:parseValue()
end

return SpetlyJson
