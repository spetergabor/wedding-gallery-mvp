local LrHttp = import "LrHttp"
local LrJson = import "LrJson"

local SpetlyApi = {}

local function jsonHeaders(token)
  return {
    { field = "Accept", value = "application/json" },
    { field = "Content-Type", value = "application/json" },
    { field = "Authorization", value = "Bearer " .. token },
  }
end

local function statusCode(headers)
  if headers and headers.status then
    return tonumber(headers.status) or 0
  end

  return 0
end

local function decodeJson(response)
  if not response or response == "" then
    return nil
  end

  local ok, parsed = pcall(function()
    return LrJson.decode(response)
  end)

  if ok then
    return parsed
  end

  return nil
end

function SpetlyApi.postJson(url, token, payload, timeout)
  local body = LrJson.encode(payload or {})
  local response, headers = LrHttp.post(url, body, jsonHeaders(token), "POST", timeout or 60)
  local status = statusCode(headers)
  local parsed = decodeJson(response)

  if status < 200 or status >= 300 then
    local message = "Spetly API request failed."

    if parsed and parsed.message then
      message = parsed.message
    end

    return nil, message .. " HTTP " .. tostring(status)
  end

  if not parsed or parsed.ok ~= true then
    local message = "Spetly API response was not successful."

    if parsed and parsed.message then
      message = parsed.message
    end

    return nil, message
  end

  return parsed, nil
end

function SpetlyApi.putFile(uploadUrl, filePath, contentType)
  local file = io.open(filePath, "rb")

  if not file then
    return false, "Rendered file could not be opened: " .. filePath
  end

  local bytes = file:read("*all")
  file:close()

  local response, headers = LrHttp.post(
    uploadUrl,
    bytes,
    {
      { field = "Content-Type", value = contentType or "application/octet-stream" },
    },
    "PUT",
    600
  )
  local status = statusCode(headers)

  if status >= 200 and status < 300 then
    return true, nil
  end

  local parsed = decodeJson(response)
  local message = "R2 upload failed."

  if parsed and parsed.message then
    message = parsed.message
  end

  return false, message .. " HTTP " .. tostring(status)
end

return SpetlyApi
