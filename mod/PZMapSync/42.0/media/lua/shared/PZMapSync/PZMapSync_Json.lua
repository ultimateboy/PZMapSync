PZMapSync = PZMapSync or {}

local Json = {}

local escapeMap = {
    ["\\"] = "\\\\",
    ["\""] = "\\\"",
    ["\b"] = "\\b",
    ["\f"] = "\\f",
    ["\n"] = "\\n",
    ["\r"] = "\\r",
    ["\t"] = "\\t"
}

local function escapeString(value)
    return tostring(value):gsub("[%z\1-\31\\\"]", function(char)
        local mapped = escapeMap[char]
        if mapped then
            return mapped
        end
        return string.format("\\u%04x", string.byte(char))
    end)
end

local function isArray(value)
    local count = 0
    local maxIndex = 0

    for key, _ in pairs(value) do
        if type(key) ~= "number" or key < 1 or key % 1 ~= 0 then
            return false
        end
        count = count + 1
        if key > maxIndex then
            maxIndex = key
        end
    end

    return maxIndex == count
end

local function encodeValue(value)
    local valueType = type(value)

    if valueType == "nil" then
        return "null"
    end

    if valueType == "boolean" then
        return value and "true" or "false"
    end

    if valueType == "number" then
        if value ~= value or value == math.huge or value == -math.huge then
            return "null"
        end
        return tostring(value)
    end

    if valueType == "string" then
        return "\"" .. escapeString(value) .. "\""
    end

    if valueType ~= "table" then
        return "\"" .. escapeString(value) .. "\""
    end

    local parts = {}
    if isArray(value) then
        for index = 1, #value do
            parts[#parts + 1] = encodeValue(value[index])
        end
        return "[" .. table.concat(parts, ",") .. "]"
    end

    for key, child in pairs(value) do
        parts[#parts + 1] = "\"" .. escapeString(key) .. "\":" .. encodeValue(child)
    end
    return "{" .. table.concat(parts, ",") .. "}"
end

function Json.encode(value)
    return encodeValue(value)
end

PZMapSync.Json = Json
