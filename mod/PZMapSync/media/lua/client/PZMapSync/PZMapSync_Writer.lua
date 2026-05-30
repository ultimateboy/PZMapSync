require "PZMapSync/PZMapSync_Config"
require "PZMapSync/PZMapSync_Json"

PZMapSync = PZMapSync or {}

local Writer = {}

local function log(message)
    print(PZMapSync.Config.LogPrefix .. " " .. message)
end

function Writer.writeSnapshot(snapshot)
    local json = PZMapSync.Json.encode(snapshot)
    local writer = getFileWriter(PZMapSync.Config.OutputFile, true, false)

    if not writer then
        log("Could not open output file: " .. tostring(PZMapSync.Config.OutputFile))
        return false
    end

    writer:write(json)
    writer:write("\n")
    writer:close()
    return true
end

PZMapSync.Writer = Writer
