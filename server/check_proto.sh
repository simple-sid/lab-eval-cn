#!/bin/bash
#  ^
#  |--- please ensure the shbang is correct for your machine
#


#This script is to check the connection protocol and port of a particular program.
#This script exit with a different exit code to display the status.
#
#exit_code  status discription(OP OUTPUT ; -- intermediate)
#
#    2       OK    connection protocol matched, the specified program runs (EXPECTED OP).
#    4       NOT   same program runs, but the protocol is different (NOT THE EXPECTED OP).
#

# NOTE : The exit code can be obtained by running the command-> echo "$?"


echo echo "first arg(bash)      :$0"
echo "second arg(port)          :$1"
echo "third arg(filename)       :$2"
echo "fourth arg(abs path)      :$3"      # PATH - It is the absolute path to the directory
echo "fifth arg(protocal)       :$4"      #        containing the file that need to be run
echo "sixth arg(autostart)      :$5"      #        before executing this script.

port=$1
filename=$2
path=$3
proto=$4
autostart=$5

#first checking the port is already opened by any program or not


#this bash commad is used to find the programs that are opened via tcp at a specific port
#   -t            means the TCP protocal
#   grep $port    gets the prgram running the $port if the available. A port can be opened
#                 be opened by a signal program only in a machine.
#   awk ...       this is used to get the pid of the prgram running on the $port from the
#                 netstat output.
#   2>/dev/null   this puts all the wrning and errors to the null file

pid=$(netstat -${proto}nlp 2>/dev/null | grep $port | awk '{split($7,a,"/"); print a[1]}' | head -n1)

#   pid           is very crucial for processing all the other things.pid of the program.
#   CPP           CPP(Current Porgram Path). This path absolute to the program that is
#                 running at the port specificed by the user.
#   head -n1      returns first line; if multiple processes use same port only the first one is returned

if [[ -z "$pid" ]]; then
    echo "No process is listening on port $port with protocol $proto"
    exit 1
fi


CPP=$(readlink -f /proc/$pid/exe 2>/dev/null)
cmdline=$(tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null)

given_path="$path/$filename"


if [[ "$CPP" == "$given_path" || "$cmdline" == *"$given_path"* ]]; then
        echo "this program is working fine by the protocol CORRECT"
        exit 2
else
        echo "this is not correct protocal. THE PROGRAM IS NOT CORRECT"
        echo "Running process info: PID=$pid, Executable=$CPP, Cmdline=$cmdline"
        exit 4
fi


#autostart is the feature that will be used to execute the socket code if it is not running.